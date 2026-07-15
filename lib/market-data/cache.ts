import type { MarketQuote } from "@/lib/market-data/types";

export type MarketQuoteCacheEntry = {
  data: MarketQuote;
  cachedAt: number;
  expiresAt: number;
};

const cache = new Map<string, MarketQuoteCacheEntry>();
const validTtlMs = 5 * 60 * 1000;
const staleTtlMs = 24 * 60 * 60 * 1000;
const unavailableTtlMs = 60 * 1000;

export function normalizeSymbol(symbol: string) {
  return symbol.trim().toUpperCase();
}

export function getValidCachedQuote(symbol: string): MarketQuote | null {
  const key = normalizeSymbol(symbol);
  const entry = cache.get(key);
  if (!entry || Date.now() > entry.expiresAt) return null;
  return {
    ...entry.data,
    source: "cache",
    originalSource: entry.data.originalSource ?? getOriginalSource(entry.data),
    fetchedAt: new Date().toISOString(),
    isStale: false
  };
}

export function getStaleCachedQuote(symbol: string): MarketQuote | null {
  const key = normalizeSymbol(symbol);
  const entry = cache.get(key);
  if (!entry || Date.now() - entry.cachedAt > staleTtlMs) return null;
  return {
    ...entry.data,
    source: "stale-cache",
    originalSource: entry.data.originalSource ?? getOriginalSource(entry.data),
    fetchedAt: new Date().toISOString(),
    isStale: true,
    error: entry.data.error ?? "Using stale cached market data."
  };
}

export function setCachedQuote(symbol: string, quote: MarketQuote) {
  const key = normalizeSymbol(symbol);
  const now = Date.now();
  const ttl = quote.source === "unavailable" ? unavailableTtlMs : validTtlMs;
  cache.set(key, {
    data: quote,
    cachedAt: now,
    expiresAt: now + ttl
  });
}

export function getMarketCacheTtls() {
  return { validTtlMs, staleTtlMs, unavailableTtlMs };
}

function getOriginalSource(quote: MarketQuote) {
  if (quote.source === "fmp" || quote.source === "yahoo") return quote.source;
  return quote.originalSource ?? null;
}
