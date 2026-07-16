import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { MarketEvent } from "@/lib/events/types";
import type { MarketQuote } from "@/lib/market-data/types";

export async function readMarketDataCache(symbol: string, options: { allowStale?: boolean } = {}) {
  try {
    const row = await prisma.marketDataCache.findUnique({ where: { symbol } });
    if (!row) return null;
    const expired = row.expiresAt.getTime() <= Date.now();
    if (expired && !options.allowStale) return null;
    const data = row.data as unknown as MarketQuote;
    return {
      ...data,
      source: expired ? "stale-cache" : "cache",
      originalSource: normalizeOriginalSource(data.originalSource ?? row.originalSource),
      updatedAt: row.updatedAt?.toISOString() ?? data.updatedAt,
      fetchedAt: new Date().toISOString(),
      isStale: expired,
      error: expired ? data.error ?? "Using stale Neon market data cache." : data.error
    } satisfies MarketQuote;
  } catch {
    return null;
  }
}

function normalizeOriginalSource(value: unknown): MarketQuote["originalSource"] {
  return value === "fmp" || value === "yahoo" ? value : null;
}

export async function writeMarketDataCache(symbol: string, quote: MarketQuote, ttlMs: number) {
  try {
    await prisma.marketDataCache.upsert({
      where: { symbol },
      update: {
        data: toJsonValue(quote),
        originalSource: quote.originalSource ?? quote.source,
        updatedAt: quote.updatedAt ? new Date(quote.updatedAt) : null,
        cachedAt: new Date(),
        expiresAt: new Date(Date.now() + ttlMs)
      },
      create: {
        symbol,
        data: toJsonValue(quote),
        originalSource: quote.originalSource ?? quote.source,
        updatedAt: quote.updatedAt ? new Date(quote.updatedAt) : null,
        expiresAt: new Date(Date.now() + ttlMs)
      }
    });
  } catch {
    // Cache persistence is best-effort and must not block market data.
  }
}

export async function readEventCache(cacheKey: string, options: { allowStale?: boolean } = {}) {
  try {
    const row = await prisma.eventCache.findUnique({ where: { cacheKey } });
    if (!row) return null;
    const expired = row.expiresAt.getTime() <= Date.now();
    if (expired && !options.allowStale) return null;
    const events = (row.data as unknown as MarketEvent[]).map((event) => ({
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
    await prisma.eventCache.upsert({
      where: { cacheKey },
      update: {
        data: toJsonValue(events),
        sources: toJsonValue(Array.from(new Set(events.map((event) => event.source)))),
        cachedAt: new Date(),
        expiresAt: new Date(Date.now() + ttlMs)
      },
      create: {
        cacheKey,
        data: toJsonValue(events),
        sources: toJsonValue(Array.from(new Set(events.map((event) => event.source)))),
        expiresAt: new Date(Date.now() + ttlMs)
      }
    });
  } catch {
    // Cache persistence is best-effort and must not block event loading.
  }
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
