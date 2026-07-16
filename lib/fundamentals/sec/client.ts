import { getCache, getStaleCache, setCache } from "@/lib/cache";
import type { SecCompanyFactsResponse } from "@/lib/fundamentals/sec/types";

const timeoutMs = 9000;
const companyFactsTtlMs = 24 * 60 * 60 * 1000;
const staleCompanyFactsTtlMs = 7 * 24 * 60 * 60 * 1000;

export type SecFetchResult<T> =
  | { ok: true; data: T; status: "real" | "cache" | "stale-cache"; updatedAt: string; warning?: string }
  | { ok: false; status: "unavailable"; error: string };

export async function fetchSecJson<T>(url: string, cacheKey: string, ttlMs = companyFactsTtlMs): Promise<SecFetchResult<T>> {
  const cached = getCache<{ data: T; updatedAt: string }>(cacheKey);
  if (cached) return { ok: true, data: cached.data, status: "cache", updatedAt: cached.updatedAt };

  const userAgent = process.env.SEC_USER_AGENT?.trim();
  if (!userAgent) {
    const stale = getUsableStale<T>(cacheKey);
    if (stale) return stale;
    return { ok: false, status: "unavailable", error: "SEC_USER_AGENT 未配置。" };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "User-Agent": userAgent,
        Accept: "application/json"
      }
    }).finally(() => clearTimeout(timeout));

    if (response.status === 404) return getStaleOrError<T>(cacheKey, "SEC 未找到该公司数据。");
    if (response.status === 429) return getStaleOrError<T>(cacheKey, "SEC 请求频率受限。");
    if (!response.ok) return getStaleOrError<T>(cacheKey, "SEC 暂时不可用。");

    const data = await response.json().catch(() => null) as T | null;
    if (!data) return getStaleOrError<T>(cacheKey, "SEC JSON 解析失败。");
    const updatedAt = new Date().toISOString();
    setCache(cacheKey, { data, updatedAt }, ttlMs);
    return { ok: true, data, status: "real", updatedAt };
  } catch {
    return getStaleOrError<T>(cacheKey, "SEC 请求超时或网络失败。");
  }
}

export async function fetchCompanyFacts(cik10: string) {
  return fetchSecJson<SecCompanyFactsResponse>(
    `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik10}.json`,
    `sec:companyfacts:${cik10}`
  );
}

function getStaleOrError<T>(cacheKey: string, error: string): SecFetchResult<T> {
  const stale = getUsableStale<T>(cacheKey);
  return stale ?? { ok: false, status: "unavailable", error };
}

function getUsableStale<T>(cacheKey: string): SecFetchResult<T> | null {
  const stale = getStaleCache<{ data: T; updatedAt: string }>(cacheKey);
  if (!stale) return null;
  const age = Date.now() - new Date(stale.updatedAt).getTime();
  if (age > staleCompanyFactsTtlMs) return null;
  return { ok: true, data: stale.data, status: "stale-cache", updatedAt: stale.updatedAt, warning: "使用过期 SEC 缓存。" };
}
