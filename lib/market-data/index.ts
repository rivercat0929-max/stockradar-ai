import { getStaleCachedQuote, getValidCachedQuote, normalizeSymbol, setCachedQuote } from "@/lib/market-data/cache";
import { fetchFmpProfile, fetchFmpQuote } from "@/lib/market-data/providers/fmp";
import { getMarketCacheTtls } from "@/lib/market-data/cache";
import { fetchYahooQuote } from "@/lib/market-data/providers/yahoo";
import type { MarketQuote, Quote, StockLookup } from "@/lib/market-data/types";

export type { LegacyMarketDataSource, MarketDataSource, MarketQuote, Quote, StockLookup } from "@/lib/market-data/types";
export { getMarketCacheTtls } from "@/lib/market-data/cache";
export { getFmpStableProfileUrl, getFmpStableQuoteUrl } from "@/lib/market-data/providers/fmp";
export { getYahooChartUrl } from "@/lib/market-data/providers/yahoo";

const inFlight = new Map<string, Promise<MarketQuote>>();

export async function getMarketQuote(symbol: string): Promise<MarketQuote> {
  const normalized = normalizeSymbol(symbol);
  if (!normalized) return unavailableQuote("", "Symbol is required.");

  const cached = getValidCachedQuote(normalized);
  if (cached) return cached;

  const supabaseCached = await readSupabaseMarketDataCache(normalized);
  if (supabaseCached) {
    setCachedQuote(normalized, supabaseCached);
    return supabaseCached;
  }

  const existing = inFlight.get(normalized);
  if (existing) return existing;

  const request = fetchFreshQuote(normalized).finally(() => inFlight.delete(normalized));
  inFlight.set(normalized, request);
  return request;
}

export async function getMarketQuotes(symbols: string[]): Promise<MarketQuote[]> {
  const normalized = Array.from(new Set(symbols.map(normalizeSymbol).filter(Boolean))).slice(0, 50);
  return Promise.all(normalized.map((symbol) => getMarketQuote(symbol)));
}

export async function getQuote(symbol: string): Promise<Quote> {
  return toLegacyQuote(await getMarketQuote(symbol));
}

export async function lookupStock(symbol: string): Promise<StockLookup> {
  const normalized = normalizeSymbol(symbol);
  const profile = await fetchFmpProfile(normalized);
  if (profile) return profile;
  const quote = await getMarketQuote(normalized);
  return {
    symbol: quote.symbol || normalized,
    companyName: quote.name ?? normalized,
    price: quote.price,
    currency: quote.currency ?? "USD"
  };
}

async function fetchFreshQuote(symbol: string): Promise<MarketQuote> {
  const fmpQuote = await fetchFmpQuote(symbol);
  if (isUsableQuote(fmpQuote)) {
    setCachedQuote(symbol, fmpQuote);
    void writeSupabaseMarketDataCache(symbol, fmpQuote, getMarketCacheTtls().validTtlMs);
    return fmpQuote;
  }

  const yahooQuote = await fetchYahooQuote(symbol);
  if (isUsableQuote(yahooQuote)) {
    setCachedQuote(symbol, yahooQuote);
    void writeSupabaseMarketDataCache(symbol, yahooQuote, getMarketCacheTtls().validTtlMs);
    return yahooQuote;
  }

  const supabaseStale = await readSupabaseMarketDataCache(symbol, { allowStale: true });
  if (supabaseStale) return supabaseStale;

  const stale = getStaleCachedQuote(symbol);
  if (stale) return stale;

  const unavailable = unavailableQuote(symbol, "Market data is temporarily unavailable.");
  setCachedQuote(symbol, unavailable);
  return unavailable;
}

function isUsableQuote(quote: MarketQuote | null): quote is MarketQuote {
  return Boolean(quote && quote.symbol && quote.price !== null && Number.isFinite(quote.price));
}

function unavailableQuote(symbol: string, error: string): MarketQuote {
  return {
    symbol,
    name: null,
    price: null,
    change: null,
    changePercent: null,
    previousClose: null,
    open: null,
    dayHigh: null,
    dayLow: null,
    volume: null,
    marketCap: null,
    currency: null,
    exchange: null,
    source: "unavailable",
    originalSource: null,
    updatedAt: null,
    fetchedAt: new Date().toISOString(),
    isStale: false,
    isMarketOpen: null,
    error
  };
}

async function readSupabaseMarketDataCache(symbol: string, options: { allowStale?: boolean } = {}) {
  if (typeof window !== "undefined") return null;
  try {
    const { readMarketDataCache } = await importServerCacheRepository();
    return readMarketDataCache(symbol, options);
  } catch {
    return null;
  }
}

async function writeSupabaseMarketDataCache(symbol: string, quote: MarketQuote, ttlMs: number) {
  if (typeof window !== "undefined") return;
  try {
    const { writeMarketDataCache } = await importServerCacheRepository();
    await writeMarketDataCache(symbol, quote, ttlMs);
  } catch {
    // Supabase cache writes are best-effort.
  }
}

async function importServerCacheRepository() {
  const load = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<typeof import("@/lib/repositories/cache")>;
  return load("@/lib/repositories/cache");
}

function toLegacyQuote(quote: MarketQuote): Quote {
  return {
    ...quote,
    ticker: quote.symbol,
    changesPercentage: quote.changePercent,
    pe: null,
    eps: null,
    yearHigh: null,
    yearLow: null,
    marketDataSource: quote.source,
    isFallback: quote.source !== "fmp",
    stale: quote.isStale || quote.source === "stale-cache"
  };
}
