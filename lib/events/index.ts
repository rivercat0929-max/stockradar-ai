import { economicCalendar2026 } from "@/data/economic-calendar-2026";
import { getStaleEventCache, getValidEventCache, setEventCache, withEventInFlight } from "@/lib/events/cache";
import type { EventType, GetMarketEventsOptions, MarketEvent, MarketEventsResult } from "@/lib/events/types";

const fmpTimeoutMs = 8000;

export type { EventDataSource, EventDateStatus, EventImportance, EventType, GetMarketEventsOptions, MarketEvent, MarketEventsResult } from "@/lib/events/types";

export async function getUpcomingEvents(days: number) {
  const from = toDateString(new Date());
  const to = toDateString(addDays(new Date(), days));
  return getMarketEvents({ from, to });
}

export async function getEventsForSymbols(symbols: string[], days: number) {
  const from = toDateString(new Date());
  const to = toDateString(addDays(new Date(), days));
  return getMarketEvents({ from, to, symbols });
}

export async function getMarketEvents(options: GetMarketEventsOptions = {}): Promise<MarketEventsResult> {
  const from = normalizeDate(options.from) ?? toDateString(new Date());
  const to = normalizeDate(options.to) ?? toDateString(addDays(new Date(from), 30));
  const symbols = normalizeSymbols(options.symbols);
  const types = options.types?.length ? options.types : undefined;
  const warnings: string[] = [];

  if (new Date(`${to}T00:00:00Z`) < new Date(`${from}T00:00:00Z`)) {
    return { events: [], warnings: ["日期范围为空或结束日期早于开始日期"] };
  }

  const macroEvents = getMacroEvents({ from, to, types });
  const companyEvents = symbols.length ? await getCompanyEvents({ from, to, symbols, types, warnings }) : [];
  const events = dedupeEvents([...macroEvents, ...companyEvents])
    .filter((event) => eventMatches(event, { from, to, symbols, types }))
    .sort((a, b) => a.startAt.localeCompare(b.startAt) || a.title.localeCompare(b.title));

  return { events, warnings };
}

function getMacroEvents({ from, to, types }: { from: string; to: string; types?: EventType[] }) {
  const key = `macro:${from}:${to}:${types?.join(",") ?? "all"}`;
  const cached = getValidEventCache(key, "macro");
  if (cached) return cached;

  const events = economicCalendar2026.filter((event) => eventMatches(event, { from, to, types }));
  setEventCache(key, events);
  return events;
}

async function getCompanyEvents({
  from,
  to,
  symbols,
  types,
  warnings
}: {
  from: string;
  to: string;
  symbols: string[];
  types?: EventType[];
  warnings: string[];
}) {
  const includeEarnings = !types || types.includes("earnings");
  const includeDividend = !types || types.includes("dividend");
  if (!includeEarnings && !includeDividend) return [];

  const key = `company:${from}:${to}:${symbols.join(",")}:${types?.join(",") ?? "all"}`;
  const cached = getValidEventCache(key, "company");
  if (cached) return cached;

  try {
    const events = await withEventInFlight(key, async () => {
      const groups = await Promise.all([
        includeEarnings ? fetchFmpCalendar("earnings-calendar", from, to, symbols, toEarningsEvent) : Promise.resolve([]),
        includeDividend ? fetchFmpCalendar("dividends-calendar", from, to, symbols, toDividendEvent) : Promise.resolve([])
      ]);
      return groups.flat();
    });
    setEventCache(key, events);
    return events;
  } catch {
    const stale = getStaleEventCache(key, "company");
    if (stale) {
      warnings.push("部分公司事件使用过期缓存");
      return stale;
    }
    warnings.push("部分公司财报或除息数据暂时不可用");
    return [];
  }
}

async function fetchFmpCalendar(
  endpoint: "earnings-calendar" | "dividends-calendar",
  from: string,
  to: string,
  symbols: string[],
  mapItem: (item: Record<string, unknown>, fetchedAt: string) => MarketEvent | null
) {
  const apiKey = process.env.FMP_API_KEY;
  if (!apiKey) return [];
  const url = getFmpCalendarUrl(endpoint, from, to, apiKey);
  const response = await fetchWithTimeout(url);
  if (!response.ok) throw new Error(`FMP ${endpoint} returned ${response.status}`);
  const data = await response.json().catch(() => null);
  if (!Array.isArray(data)) return [];

  const fetchedAt = new Date().toISOString();
  return data
    .filter((item) => symbols.includes(getString(item.symbol ?? item.ticker).toUpperCase()))
    .flatMap((item) => {
      const event = mapItem(item, fetchedAt);
      return event ? [event] : [];
    });
}

function toEarningsEvent(item: Record<string, unknown>, fetchedAt: string): MarketEvent | null {
  const symbol = getString(item.symbol ?? item.ticker).toUpperCase();
  const date = normalizeDate(getString(item.date ?? item.reportDate ?? item.fiscalDateEnding));
  if (!symbol || !date) return null;
  const timeLabel = getString(item.time ?? item.timezone ?? item.when);
  const dateStatus = inferDateStatus(item);
  const companyName = getString(item.companyName ?? item.name) || null;
  const session = getEarningsSessionLabel(timeLabel);

  return {
    id: `fmp-earnings-${symbol}-${date}`,
    type: "earnings",
    title: `${symbol} 财报${session ? `（${session}）` : ""}`,
    description: session ? `FMP 财报日历，发布时间：${session}` : "FMP 财报日历，具体发布时间未知。",
    symbol,
    companyName,
    startAt: date,
    endAt: null,
    timezone: null,
    importance: "high",
    dateStatus,
    source: "fmp",
    sourceName: "FMP",
    sourceUrl: "https://financialmodelingprep.com/stable/earnings-calendar",
    updatedAt: fetchedAt,
    fetchedAt,
    isStale: false,
    previousValue: nullableText(item.epsEstimated ?? item.epsestimate),
    forecastValue: nullableText(item.revenueEstimated ?? item.revenueestimate),
    actualValue: nullableText(item.eps)
  };
}

function toDividendEvent(item: Record<string, unknown>, fetchedAt: string): MarketEvent | null {
  const symbol = getString(item.symbol ?? item.ticker).toUpperCase();
  const date = normalizeDate(getString(item.date ?? item.exDividendDate));
  if (!symbol || !date) return null;
  const companyName = getString(item.companyName ?? item.name) || null;
  const dividend = nullableText(item.dividend ?? item.adjDividend);
  const paymentDate = normalizeDate(getString(item.paymentDate));

  return {
    id: `fmp-dividend-${symbol}-${date}`,
    type: "dividend",
    title: `${symbol} 除息日`,
    description: `每股股息：${dividend ?? "--"}${paymentDate ? `；支付日：${paymentDate}` : ""}`,
    symbol,
    companyName,
    startAt: date,
    endAt: paymentDate,
    timezone: null,
    importance: "medium",
    dateStatus: "confirmed",
    source: "fmp",
    sourceName: "FMP",
    sourceUrl: "https://financialmodelingprep.com/stable/dividends-calendar",
    updatedAt: fetchedAt,
    fetchedAt,
    isStale: false,
    forecastValue: dividend,
    actualValue: null
  };
}

function eventMatches(event: MarketEvent, filters: { from: string; to: string; symbols?: string[]; types?: EventType[] }) {
  const date = event.startAt.slice(0, 10);
  if (date < filters.from || date > filters.to) return false;
  if (filters.types?.length && !filters.types.includes(event.type)) return false;
  if (filters.symbols?.length && event.symbol && !filters.symbols.includes(event.symbol.toUpperCase())) return false;
  return true;
}

function dedupeEvents(events: MarketEvent[]) {
  const map = new Map<string, MarketEvent>();
  events.forEach((event) => {
    const key = `${event.type}:${event.symbol ?? "macro"}:${event.startAt}:${event.title}`;
    if (!map.has(key)) map.set(key, event);
  });
  return Array.from(map.values());
}

function normalizeSymbols(symbols?: string[]) {
  return Array.from(new Set((symbols ?? []).map((symbol) => symbol.trim().toUpperCase()).filter(Boolean))).slice(0, 50);
}

function normalizeDate(value?: string | null) {
  if (!value) return null;
  const match = value.match(/\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : null;
}

function inferDateStatus(item: Record<string, unknown>) {
  const status = getString(item.dateStatus ?? item.status).toLowerCase();
  if (status.includes("confirmed")) return "confirmed" as const;
  if (status.includes("estimated") || status.includes("estimate")) return "estimated" as const;
  if (typeof item.confirmed === "boolean") return item.confirmed ? "confirmed" as const : "estimated" as const;
  return "estimated" as const;
}

function getEarningsSessionLabel(value: string) {
  const normalized = value.toLowerCase();
  if (normalized.includes("bmo") || normalized.includes("before")) return "盘前";
  if (normalized.includes("amc") || normalized.includes("after")) return "盘后";
  return null;
}

function getFmpCalendarUrl(endpoint: string, from: string, to: string, apiKey: string) {
  const url = new URL(`https://financialmodelingprep.com/stable/${endpoint}`);
  url.searchParams.set("from", from);
  url.searchParams.set("to", to);
  url.searchParams.set("apikey", apiKey);
  return url.toString();
}

async function fetchWithTimeout(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), fmpTimeoutMs);
  try {
    return await fetch(url, { cache: "no-store", signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toDateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function nullableText(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string" && value.trim()) return value.trim();
  return null;
}
