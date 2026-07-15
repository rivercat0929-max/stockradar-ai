import type { MarketQuote } from "@/lib/market-data/types";

const timeoutMs = 8000;

export function getYahooChartUrl(symbol: string) {
  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol.trim().toUpperCase())}`);
  url.searchParams.set("range", "1d");
  url.searchParams.set("interval", "1m");
  return url.toString();
}

export async function fetchYahooQuote(symbol: string): Promise<MarketQuote | null> {
  try {
    const response = await fetchWithTimeout(getYahooChartUrl(symbol));
    if (!response.ok) {
      logProviderError({ provider: "yahoo", symbol, status: response.status, errorName: "HttpError", errorMessage: `Yahoo returned ${response.status}` });
      return null;
    }

    const data = await response.json().catch(() => null);
    const result = data?.chart?.result?.[0];
    const meta = result?.meta;
    const price = nullableNumber(meta?.regularMarketPrice);
    if (price === null) {
      logProviderError({ provider: "yahoo", symbol, status: response.status, errorName: "MissingField", errorMessage: "Yahoo quote missing price" });
      return null;
    }

    const previousClose = nullableNumber(meta?.chartPreviousClose ?? meta?.previousClose);
    const change = previousClose === null ? null : roundNumber(price - previousClose);
    const changePercent = previousClose && previousClose !== 0 && change !== null ? roundNumber((change / previousClose) * 100) : null;
    const fetchedAt = new Date().toISOString();

    return {
      symbol,
      name: getString(meta?.shortName ?? meta?.longName) || null,
      price,
      change,
      changePercent,
      previousClose,
      open: nullableNumber(meta?.regularMarketOpen),
      dayHigh: nullableNumber(meta?.regularMarketDayHigh),
      dayLow: nullableNumber(meta?.regularMarketDayLow),
      volume: nullableNumber(meta?.regularMarketVolume),
      marketCap: nullableNumber(meta?.marketCap),
      currency: getString(meta?.currency) || null,
      exchange: getString(meta?.exchangeName ?? meta?.fullExchangeName) || null,
      source: "yahoo",
      originalSource: "yahoo",
      updatedAt: getDateString(meta?.regularMarketTime) ?? fetchedAt,
      fetchedAt,
      isStale: false,
      isMarketOpen: null
    };
  } catch (error) {
    logProviderError({ provider: "yahoo", symbol, status: null, errorName: error instanceof Error ? error.name : "UnknownError", errorMessage: sanitizeError(error) });
    return null;
  }
}

async function fetchWithTimeout(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { cache: "no-store", signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function nullableNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function getDateString(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return new Date(value * 1000).toISOString();
  if (typeof value === "string" && value.trim()) return value;
  return null;
}

function roundNumber(value: number) {
  return Math.round(value * 100) / 100;
}

function sanitizeError(error: unknown) {
  return (error instanceof Error ? error.message : String(error)).slice(0, 180);
}

function logProviderError(input: { provider: string; symbol: string; status: number | null; errorName: string; errorMessage: string }) {
  console.warn("market-data provider error", input);
}
