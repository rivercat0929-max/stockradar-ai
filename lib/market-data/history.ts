import { getCache, getStaleCache, setCache } from "@/lib/cache";

export type PriceBar = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  adjustedClose: number;
  volume: number;
};

export type HistoryResult =
  | { ok: true; bars: PriceBar[]; source: "fmp" | "yahoo" | "cache" | "stale-cache"; updatedAt: string; warnings: string[] }
  | { ok: false; bars: []; source: "unavailable"; updatedAt: null; warnings: string[] };

const freshTtlMs = 15 * 60 * 1000;
const staleTtlMs = 48 * 60 * 60 * 1000;

export async function getHistoricalPrices(symbol: string): Promise<HistoryResult> {
  const normalized = symbol.trim().toUpperCase();
  const key = `history:daily:${normalized}`;
  const cached = getCache<{ bars: PriceBar[]; updatedAt: string; source: "fmp" | "yahoo" }>(key);
  if (cached) return { ok: true, bars: cached.bars, source: "cache", updatedAt: cached.updatedAt, warnings: [] };

  const fmp = await fetchFmpHistory(normalized);
  if (fmp.length) return persist(key, fmp, "fmp");

  const yahoo = await fetchYahooHistory(normalized);
  if (yahoo.length) return persist(key, yahoo, "yahoo");

  const stale = getStaleCache<{ bars: PriceBar[]; updatedAt: string; source: "fmp" | "yahoo" }>(key);
  if (stale && Date.now() - new Date(stale.updatedAt).getTime() <= staleTtlMs) {
    return { ok: true, bars: stale.bars, source: "stale-cache", updatedAt: stale.updatedAt, warnings: ["使用过期历史行情缓存"] };
  }
  return { ok: false, bars: [], source: "unavailable", updatedAt: null, warnings: ["历史K线暂无可靠数据"] };
}

async function fetchFmpHistory(symbol: string) {
  const apiKey = process.env.FMP_API_KEY;
  if (!apiKey) return [];
  const url = new URL(`https://financialmodelingprep.com/stable/historical-price-eod/full`);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("apikey", apiKey);
  try {
    const response = await fetch(url.toString(), { cache: "no-store" });
    if (!response.ok) return [];
    const data = await response.json().catch(() => null);
    const rows = Array.isArray(data) ? data : Array.isArray(data?.historical) ? data.historical : [];
    return rows.map(toFmpBar).filter(isPriceBar).sort(byDate).slice(-260);
  } catch {
    return [];
  }
}

async function fetchYahooHistory(symbol: string) {
  const end = Math.floor(Date.now() / 1000);
  const start = end - 370 * 24 * 60 * 60;
  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`);
  url.searchParams.set("period1", String(start));
  url.searchParams.set("period2", String(end));
  url.searchParams.set("interval", "1d");
  try {
    const response = await fetch(url.toString(), { cache: "no-store" });
    if (!response.ok) return [];
    const data = await response.json().catch(() => null);
    const result = data?.chart?.result?.[0];
    const timestamps: number[] = result?.timestamp ?? [];
    const quote = result?.indicators?.quote?.[0] ?? {};
    const adj = result?.indicators?.adjclose?.[0]?.adjclose ?? [];
    return timestamps.map((timestamp, index) => toYahooBar(timestamp, index, quote, adj)).filter(isPriceBar).sort(byDate).slice(-260);
  } catch {
    return [];
  }
}

function persist(key: string, bars: PriceBar[], source: "fmp" | "yahoo"): HistoryResult {
  const updatedAt = new Date().toISOString();
  setCache(key, { bars, updatedAt, source }, freshTtlMs);
  return { ok: true, bars, source, updatedAt, warnings: [] };
}

function toFmpBar(item: Record<string, unknown>) {
  return toBar({
    date: stringValue(item.date),
    open: item.open,
    high: item.high,
    low: item.low,
    close: item.close,
    adjustedClose: item.adjClose ?? item.adjustedClose ?? item.close,
    volume: item.volume
  });
}

function toYahooBar(timestamp: number, index: number, quote: Record<string, number[]>, adj: number[]) {
  return toBar({
    date: new Date(timestamp * 1000).toISOString().slice(0, 10),
    open: quote.open?.[index],
    high: quote.high?.[index],
    low: quote.low?.[index],
    close: quote.close?.[index],
    adjustedClose: adj?.[index] ?? quote.close?.[index],
    volume: quote.volume?.[index]
  });
}

function toBar(input: Record<string, unknown>): PriceBar | null {
  const date = stringValue(input.date);
  const open = numberValue(input.open);
  const high = numberValue(input.high);
  const low = numberValue(input.low);
  const close = numberValue(input.close);
  const adjustedClose = numberValue(input.adjustedClose);
  const volume = numberValue(input.volume);
  if (!date || open === null || high === null || low === null || close === null || adjustedClose === null || volume === null) return null;
  return { date, open, high, low, close, adjustedClose, volume };
}

function byDate(a: PriceBar, b: PriceBar) {
  return a.date.localeCompare(b.date);
}

function isPriceBar(value: PriceBar | null): value is PriceBar {
  return value !== null;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}
