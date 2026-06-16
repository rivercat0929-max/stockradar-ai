import { getCache, getStaleCache, setCache } from "@/lib/cache";

export type MarketDataSource = "fmp-stable" | "yahoo" | "mock";

export type Quote = {
  ticker: string;
  name: string;
  price: number;
  change: number;
  changesPercentage: number;
  pe?: number | null;
  eps?: number | null;
  marketCap: number | null;
  volume: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  yearHigh: number | null;
  yearLow: number | null;
  marketDataSource: MarketDataSource;
  isFallback: boolean;
  stale?: boolean;
};

export type StockLookup = {
  symbol: string;
  companyName: string;
  price: number | null;
  currency: string;
};

const fallbackPrices: Record<string, number> = {
  TSLA: 320,
  AMZN: 220,
  NVDA: 175,
  CEG: 300,
  MSFT: 430,
  GOOGL: 180,
  META: 500,
  AAPL: 210
};

const fallbackNames: Record<string, string> = {
  TSLA: "Tesla, Inc.",
  AMZN: "Amazon.com, Inc.",
  NVDA: "NVIDIA Corporation",
  CEG: "Constellation Energy Corporation",
  MSFT: "Microsoft Corporation",
  GOOGL: "Alphabet Inc.",
  META: "Meta Platforms, Inc.",
  AAPL: "Apple Inc."
};

const quoteCacheTtlMs = 5 * 60 * 1000;

export function getFmpStableQuoteUrl(ticker: string, apiKey: string) {
  const url = new URL("https://financialmodelingprep.com/stable/quote");
  url.searchParams.set("symbol", ticker.trim().toUpperCase());
  url.searchParams.set("apikey", apiKey);
  return url.toString();
}

export function getFmpStableProfileUrl(ticker: string, apiKey: string) {
  const url = new URL("https://financialmodelingprep.com/stable/profile");
  url.searchParams.set("symbol", ticker.trim().toUpperCase());
  url.searchParams.set("apikey", apiKey);
  return url.toString();
}

export function getYahooChartUrl(ticker: string) {
  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker.trim().toUpperCase())}`);
  url.searchParams.set("range", "1d");
  url.searchParams.set("interval", "1m");
  return url.toString();
}

export async function getQuote(ticker: string): Promise<Quote> {
  const normalizedTicker = ticker.trim().toUpperCase();
  const apiKey = process.env.FMP_API_KEY;

  if (apiKey) {
    const fmpQuote = await getFmpStableQuote(normalizedTicker, apiKey);
    if (fmpQuote) return fmpQuote;
  }

  const yahooQuote = await getYahooQuote(normalizedTicker);
  if (yahooQuote) return yahooQuote;

  return mockQuote(normalizedTicker);
}

export async function lookupStock(symbol: string): Promise<StockLookup> {
  const normalizedSymbol = symbol.trim().toUpperCase();
  const apiKey = process.env.FMP_API_KEY;

  if (apiKey) {
    const fmpProfile = await getFmpStableProfile(normalizedSymbol, apiKey);
    if (fmpProfile) return fmpProfile;

    const fmpQuote = await getFmpStableQuote(normalizedSymbol, apiKey);
    if (fmpQuote) {
      return {
        symbol: fmpQuote.ticker,
        companyName: fmpQuote.name,
        price: fmpQuote.price,
        currency: "USD"
      };
    }
  }

  const yahooQuote = await getYahooQuote(normalizedSymbol);
  if (yahooQuote) {
    return {
      symbol: yahooQuote.ticker,
      companyName: yahooQuote.name,
      price: yahooQuote.price,
      currency: "USD"
    };
  }

  return {
    symbol: normalizedSymbol,
    companyName: fallbackNames[normalizedSymbol] ?? normalizedSymbol,
    price: fallbackPrices[normalizedSymbol] ?? null,
    currency: "USD"
  };
}

async function getFmpStableProfile(ticker: string, apiKey: string): Promise<StockLookup | null> {
  try {
    const response = await fetch(getFmpStableProfileUrl(ticker, apiKey), { cache: "no-store" });
    if (!response.ok) return null;

    const data = await response.json();
    const profile = Array.isArray(data) ? data[0] : null;
    if (!profile) return null;

    const companyName = profile.companyName ?? profile.companyNameLong ?? profile.name;
    if (typeof companyName !== "string" || !companyName.trim()) return null;

    return {
      symbol: String(profile.symbol ?? ticker).toUpperCase(),
      companyName,
      price: nullableNumber(profile.price),
      currency: typeof profile.currency === "string" ? profile.currency : "USD"
    };
  } catch {
    return null;
  }
}

export async function getFmpStableQuote(ticker: string, apiKey: string): Promise<Quote | null> {
  const cacheKey = `fmp:quote:${ticker.trim().toUpperCase()}`;
  const cachedQuote = getCache<Quote>(cacheKey);
  if (cachedQuote) return cachedQuote;

  const staleQuote = getStaleCache<Quote>(cacheKey);

  try {
    const response = await fetch(getFmpStableQuoteUrl(ticker, apiKey), { cache: "no-store" });
    if (!response.ok) return staleQuote ? { ...staleQuote, stale: true } : null;

    const data = await response.json();
    const quote = Array.isArray(data) ? data[0] : null;
    if (!quote || typeof quote.price !== "number") return staleQuote ? { ...staleQuote, stale: true } : null;

    const result: Quote = {
      ticker: String(quote.symbol ?? ticker).toUpperCase(),
      name: String(quote.name ?? ticker),
      price: Number(quote.price),
      change: numberOrZero(quote.change),
      changesPercentage: numberOrZero(quote.changesPercentage ?? quote.changePercentage),
      pe: nullableNumber(quote.pe),
      eps: nullableNumber(quote.eps),
      marketCap: nullableNumber(quote.marketCap),
      volume: nullableNumber(quote.volume),
      dayHigh: nullableNumber(quote.dayHigh),
      dayLow: nullableNumber(quote.dayLow),
      yearHigh: nullableNumber(quote.yearHigh),
      yearLow: nullableNumber(quote.yearLow),
      marketDataSource: "fmp-stable",
      isFallback: false
    };

    setCache(cacheKey, result, quoteCacheTtlMs);
    return result;
  } catch {
    return staleQuote ? { ...staleQuote, stale: true } : null;
  }
}

async function getYahooQuote(ticker: string): Promise<Quote | null> {
  try {
    const response = await fetch(getYahooChartUrl(ticker), { cache: "no-store" });
    if (!response.ok) return null;

    const data = await response.json();
    const result = data?.chart?.result?.[0];
    const meta = result?.meta;
    const price = nullableNumber(meta?.regularMarketPrice);
    if (price === null) return null;

    const previousClose = nullableNumber(meta?.chartPreviousClose);
    const change = previousClose === null ? 0 : price - previousClose;
    const changesPercentage = previousClose && previousClose !== 0 ? (change / previousClose) * 100 : 0;

    return {
      ticker,
      name: String(meta?.shortName ?? meta?.longName ?? fallbackNames[ticker] ?? ticker),
      price,
      change: roundNumber(change),
      changesPercentage: roundNumber(changesPercentage),
      marketCap: nullableNumber(meta?.marketCap),
      volume: nullableNumber(meta?.regularMarketVolume),
      dayHigh: nullableNumber(meta?.regularMarketDayHigh),
      dayLow: nullableNumber(meta?.regularMarketDayLow),
      yearHigh: nullableNumber(meta?.fiftyTwoWeekHigh),
      yearLow: nullableNumber(meta?.fiftyTwoWeekLow),
      marketDataSource: "yahoo",
      isFallback: true
    };
  } catch {
    return null;
  }
}

function mockQuote(ticker: string): Quote {
  const price = fallbackPrices[ticker] ?? 0;

  return {
    ticker,
    name: fallbackNames[ticker] ?? ticker,
    price,
    change: 0,
    changesPercentage: 0,
    pe: null,
    eps: null,
    marketCap: null,
    volume: null,
    dayHigh: null,
    dayLow: null,
    yearHigh: null,
    yearLow: null,
    marketDataSource: "mock",
    isFallback: true
  };
}

function nullableNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function numberOrZero(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function roundNumber(value: number) {
  return Math.round(value * 100) / 100;
}
