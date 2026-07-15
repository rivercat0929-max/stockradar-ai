import type { MarketEvent } from "@/lib/events/types";

type CacheEntry = {
  events: MarketEvent[];
  fetchedAtMs: number;
};

const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<MarketEvent[]>>();

const companyFreshTtlMs = 6 * 60 * 60 * 1000;
const companyStaleTtlMs = 7 * 24 * 60 * 60 * 1000;
const macroFreshTtlMs = 24 * 60 * 60 * 1000;
const macroStaleTtlMs = 30 * 24 * 60 * 60 * 1000;

export function getEventCacheTtls(kind: "company" | "macro") {
  return kind === "company"
    ? { freshTtlMs: companyFreshTtlMs, staleTtlMs: companyStaleTtlMs }
    : { freshTtlMs: macroFreshTtlMs, staleTtlMs: macroStaleTtlMs };
}

export function getValidEventCache(key: string, kind: "company" | "macro") {
  const entry = cache.get(key);
  if (!entry) return null;
  const { freshTtlMs } = getEventCacheTtls(kind);
  if (Date.now() - entry.fetchedAtMs > freshTtlMs) return null;
  return entry.events;
}

export function getStaleEventCache(key: string, kind: "company" | "macro") {
  const entry = cache.get(key);
  if (!entry) return null;
  const { staleTtlMs } = getEventCacheTtls(kind);
  if (Date.now() - entry.fetchedAtMs > staleTtlMs) return null;
  return entry.events.map((event) => ({
    ...event,
    source: "stale-cache" as const,
    sourceName: `过期缓存 · ${event.sourceName}`,
    isStale: true
  }));
}

export function setEventCache(key: string, events: MarketEvent[]) {
  cache.set(key, { events, fetchedAtMs: Date.now() });
}

export async function withEventInFlight(key: string, load: () => Promise<MarketEvent[]>) {
  const existing = inFlight.get(key);
  if (existing) return existing;
  const request = load().finally(() => inFlight.delete(key));
  inFlight.set(key, request);
  return request;
}
