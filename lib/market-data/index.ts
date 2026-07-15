import { getStaleCachedQuote, getValidCachedQuote, normalizeSymbol, setCachedQuote } from "@/lib/market-data/cache";
import { fetchFmpProfile, fetchFmpQuote } from "@/lib/market-data/providers/fmp";
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
    return fmpQuote;
  }

  const yahooQuote = await fetchYahooQuote(symbol);
  if (isUsableQuote(yahooQuote)) {
    setCachedQuote(symbol, yahooQuote);
    return yahooQuote;
  }

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
