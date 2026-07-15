import type { MarketQuote } from "@/lib/market-data/types";

const timeoutMs = 8000;

export function getFmpStableQuoteUrl(symbol: string, apiKey: string) {
  const url = new URL("https://financialmodelingprep.com/stable/quote");
  url.searchParams.set("symbol", symbol.trim().toUpperCase());
  url.searchParams.set("apikey", apiKey);
  return url.toString();
}

export function getFmpStableProfileUrl(symbol: string, apiKey: string) {
  const url = new URL("https://financialmodelingprep.com/stable/profile");
  url.searchParams.set("symbol", symbol.trim().toUpperCase());
  url.searchParams.set("apikey", apiKey);
  return url.toString();
}

export async function fetchFmpQuote(symbol: string): Promise<MarketQuote | null> {
  const apiKey = process.env.FMP_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetchWithTimeout(getFmpStableQuoteUrl(symbol, apiKey));
    if (!response.ok) {
      logProviderError({ provider: "fmp", symbol, status: response.status, errorName: "HttpError", errorMessage: `FMP returned ${response.status}` });
      return null;
    }

    const data = await response.json().catch(() => null);
    if (!Array.isArray(data) || data.length === 0) {
      logProviderError({ provider: "fmp", symbol, status: response.status, errorName: "EmptyData", errorMessage: "FMP returned no quote rows" });
      return null;
    }

    const item = data[0];
    if (!item || typeof item !== "object") return null;
    const price = nullableNumber(item.price);
    if (price === null) {
      logProviderError({ provider: "fmp", symbol, status: response.status, errorName: "MissingField", errorMessage: "FMP quote missing price" });
      return null;
    }

    const fetchedAt = new Date().toISOString();
    return {
      symbol: getString(item.symbol) || symbol,
      name: getString(item.name) || null,
      price,
      change: nullableNumber(item.change),
      changePercent: nullableNumber(item.changesPercentage ?? item.changePercentage),
      previousClose: nullableNumber(item.previousClose),
      open: nullableNumber(item.open),
      dayHigh: nullableNumber(item.dayHigh),
      dayLow: nullableNumber(item.dayLow),
      volume: nullableNumber(item.volume),
      marketCap: nullableNumber(item.marketCap),
      currency: getString(item.currency) || "USD",
      exchange: getString(item.exchange) || getString(item.exchangeShortName) || null,
      source: "fmp",
      originalSource: "fmp",
      updatedAt: getDateString(item.timestamp) ?? fetchedAt,
      fetchedAt,
      isStale: false,
      isMarketOpen: null
    };
  } catch (error) {
    logProviderError({ provider: "fmp", symbol, status: null, errorName: error instanceof Error ? error.name : "UnknownError", errorMessage: sanitizeError(error) });
    return null;
  }
}

export async function fetchFmpProfile(symbol: string) {
  const apiKey = process.env.FMP_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetchWithTimeout(getFmpStableProfileUrl(symbol, apiKey));
    if (!response.ok) return null;
    const data = await response.json().catch(() => null);
    const profile = Array.isArray(data) ? data[0] : null;
    if (!profile) return null;
    const companyName = getString(profile.companyName ?? profile.companyNameLong ?? profile.name);
    if (!companyName) return null;
    return {
      symbol: getString(profile.symbol) || symbol,
      companyName,
      price: nullableNumber(profile.price),
      currency: getString(profile.currency) || "USD"
    };
  } catch (error) {
    logProviderError({ provider: "fmp", symbol, status: null, errorName: error instanceof Error ? error.name : "UnknownError", errorMessage: sanitizeError(error) });
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

function sanitizeError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/apikey=[^&\s]+/gi, "apikey=***").slice(0, 180);
}

function logProviderError(input: { provider: string; symbol: string; status: number | null; errorName: string; errorMessage: string }) {
  console.warn("market-data provider error", input);
}
