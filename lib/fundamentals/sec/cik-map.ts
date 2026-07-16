import { fetchSecJson } from "@/lib/fundamentals/sec/client";

type SecTickerRow = {
  cik_str: number;
  ticker: string;
  title: string;
};

type CikLookup =
  | { ok: true; cik: string; companyName: string; status: "real" | "cache" | "stale-cache"; updatedAt: string }
  | { ok: false; status: "unavailable"; error: string };

const tickerMapTtlMs = 7 * 24 * 60 * 60 * 1000;
let inMemoryMap: { rows: SecTickerRow[]; updatedAt: string; status: "real" | "cache" | "stale-cache" } | null = null;

export async function getCikByTicker(symbol: string): Promise<CikLookup> {
  const normalized = symbol.trim().toUpperCase().replace(".", "-");
  if (!normalized) return { ok: false, status: "unavailable", error: "股票代码为空。" };

  const map = await getTickerMap();
  if (!map.ok) return map;
  const row = map.rows.find((item) => item.ticker.toUpperCase() === normalized);
  if (!row) return { ok: false, status: "unavailable", error: "SEC 暂无该 ticker 的 CIK 映射。" };
  return {
    ok: true,
    cik: String(row.cik_str).padStart(10, "0"),
    companyName: row.title,
    status: map.status,
    updatedAt: map.updatedAt
  };
}

async function getTickerMap() {
  if (inMemoryMap) return { ok: true as const, ...inMemoryMap };
  const result = await fetchSecJson<Record<string, SecTickerRow>>(
    "https://www.sec.gov/files/company_tickers.json",
    "sec:company_tickers",
    tickerMapTtlMs
  );
  if (!result.ok) return result;
  const rows = Object.values(result.data).filter((item) => item?.ticker && item?.cik_str);
  inMemoryMap = { rows, updatedAt: result.updatedAt, status: result.status };
  return { ok: true as const, ...inMemoryMap };
}
