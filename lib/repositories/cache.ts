import "server-only";
import { supabaseAdminRequest } from "@/lib/supabase/admin";
import type { MarketEvent } from "@/lib/events/types";
import type { MarketQuote } from "@/lib/market-data/types";

type MarketCacheRow = {
  symbol: string;
  data: MarketQuote;
  original_source: string | null;
  updated_at: string | null;
  cached_at: string;
  expires_at: string;
};

type EventCacheRow = {
  cache_key: string;
  data: MarketEvent[];
  sources: string[];
  cached_at: string;
  expires_at: string;
};

export async function readMarketDataCache(symbol: string, options: { allowStale?: boolean } = {}) {
  try {
    const rows = await supabaseAdminRequest<MarketCacheRow[]>(
      `market_data_cache?symbol=eq.${encodeURIComponent(symbol)}&select=*`
    );
    const row = rows?.[0];
    if (!row) return null;
    const expired = new Date(row.expires_at).getTime() <= Date.now();
    if (expired && !options.allowStale) return null;
    return {
      ...row.data,
      source: expired ? "stale-cache" : "cache",
      originalSource: (row.data.originalSource ?? row.original_source ?? null) as MarketQuote["originalSource"],
      updatedAt: row.updated_at ?? row.data.updatedAt,
      fetchedAt: new Date().toISOString(),
      isStale: expired,
      error: expired ? row.data.error ?? "Using stale Supabase market data cache." : row.data.error
    } satisfies MarketQuote;
  } catch {
    return null;
  }
}

export async function writeMarketDataCache(symbol: string, quote: MarketQuote, ttlMs: number) {
  try {
    await supabaseAdminRequest("market_data_cache", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        symbol,
        data: quote,
        original_source: quote.originalSource ?? quote.source,
        updated_at: quote.updatedAt,
        cached_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + ttlMs).toISOString()
      })
    });
  } catch {
    // Cache persistence is best-effort and must not block market data.
  }
}

export async function readEventCache(cacheKey: string, options: { allowStale?: boolean } = {}) {
  try {
    const rows = await supabaseAdminRequest<EventCacheRow[]>(
      `event_cache?cache_key=eq.${encodeURIComponent(cacheKey)}&select=*`
    );
    const row = rows?.[0];
    if (!row) return null;
    const expired = new Date(row.expires_at).getTime() <= Date.now();
    if (expired && !options.allowStale) return null;
    const events = row.data.map((event) => ({
      ...event,
      source: expired ? "stale-cache" : "cache",
      sourceName: expired ? `过期缓存 · ${event.sourceName}` : `缓存 · ${event.sourceName}`,
      fetchedAt: new Date().toISOString(),
      isStale: expired
    })) satisfies MarketEvent[];
    return events;
  } catch {
    return null;
  }
}

export async function writeEventCache(cacheKey: string, events: MarketEvent[], ttlMs: number) {
  try {
    await supabaseAdminRequest("event_cache", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        cache_key: cacheKey,
        data: events,
        sources: Array.from(new Set(events.map((event) => event.source))),
        cached_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + ttlMs).toISOString()
      })
    });
  } catch {
    // Cache persistence is best-effort and must not block event loading.
  }
}
