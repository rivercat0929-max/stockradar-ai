type CacheEntry = {
  value: unknown;
  expiresAt: number;
  createdAt: number;
};

const cache = new Map<string, CacheEntry>();

export function getCache<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;

  if (entry.expiresAt <= Date.now()) return null;
  return entry.value as T;
}

export function getStaleCache<T>(key: string): T | null {
  const entry = cache.get(key);
  return entry ? (entry.value as T) : null;
}

export function setCache(key: string, value: unknown, ttlMs: number) {
  cache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
    createdAt: Date.now()
  });
}

export function getCacheStats() {
  const now = Date.now();
  const entries = Array.from(cache.entries());
  const createdAtValues = entries.map(([, entry]) => entry.createdAt).filter((value) => Number.isFinite(value));

  return {
    totalEntries: entries.length,
    activeEntries: entries.filter(([, entry]) => entry.expiresAt > now).length,
    staleEntries: entries.filter(([, entry]) => entry.expiresAt <= now).length,
    lastUpdatedAt: createdAtValues.length ? new Date(Math.max(...createdAtValues)).toISOString() : null
  };
}
