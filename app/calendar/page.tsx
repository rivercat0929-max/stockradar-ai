"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import type { EventImportance, EventType, MarketEvent } from "@/lib/events/types";

type ViewMode = "month" | "list";
type RangeMode = "today" | "7d" | "30d";
type ScopeMode = "all" | "holdings" | "watchlist";

type HoldingLike = {
  ticker: string;
};

type WatchlistLike = {
  ticker: string;
};

type EventsApiResponse = {
  success: boolean;
  data: MarketEvent[];
  warnings?: string[];
  meta?: {
    count: number;
    sources: string[];
    updatedAt: string | null;
  };
};

const eventTypes: Array<{ type: EventType | "all"; label: string }> = [
  { type: "all", label: "全部类型" },
  { type: "earnings", label: "财报" },
  { type: "dividend", label: "除息" },
  { type: "fomc", label: "FOMC" },
  { type: "cpi", label: "CPI" },
  { type: "ppi", label: "PPI" },
  { type: "nonfarm-payrolls", label: "非农" },
  { type: "gdp", label: "GDP" }
];

const importanceFilters: Array<{ value: EventImportance | "all"; label: string }> = [
  { value: "all", label: "全部重要性" },
  { value: "high", label: "高重要性" },
  { value: "medium", label: "中重要性" },
  { value: "low", label: "低重要性" }
];

export default function CalendarPage() {
  const [events, setEvents] = useState<MarketEvent[]>([]);
  const [holdings, setHoldings] = useState<HoldingLike[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistLike[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [rangeMode, setRangeMode] = useState<RangeMode>("30d");
  const [typeFilter, setTypeFilter] = useState<EventType | "all">("all");
  const [importanceFilter, setImportanceFilter] = useState<EventImportance | "all">("all");
  const [scopeMode, setScopeMode] = useState<ScopeMode>("all");
  const [search, setSearch] = useState("");

  const range = useMemo(() => getRange(rangeMode), [rangeMode]);
  const holdingSymbols = useMemo(() => getSymbols(holdings), [holdings]);
  const watchlistSymbols = useMemo(() => getSymbols(watchlist), [watchlist]);
  const allSymbols = useMemo(() => Array.from(new Set([...holdingSymbols, ...watchlistSymbols])), [holdingSymbols, watchlistSymbols]);

  useEffect(() => {
    loadCalendar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.from, range.to]);

  async function loadCalendar() {
    setIsLoading(true);
    setError(null);
    setWarnings([]);

    try {
      const [holdingsResponse, watchlistResponse] = await Promise.all([
        fetch("/api/holdings", { cache: "no-store" }),
        fetch("/api/watchlist", { cache: "no-store" })
      ]);
      const holdingsData = await holdingsResponse.json().catch(() => []);
      const watchlistData = await watchlistResponse.json().catch(() => ({ items: [] }));
      const nextHoldings = Array.isArray(holdingsData) ? holdingsData : [];
      const nextWatchlist = Array.isArray(watchlistData.items) ? watchlistData.items : [];
      const nextSymbols = Array.from(new Set([...getSymbols(nextHoldings), ...getSymbols(nextWatchlist)]));

      setHoldings(nextHoldings);
      setWatchlist(nextWatchlist);

      const params = new URLSearchParams({ from: range.from, to: range.to });
      if (nextSymbols.length) params.set("symbols", nextSymbols.join(","));
      const response = await fetch(`/api/events?${params.toString()}`, { cache: "no-store" });
      const payload = (await response.json()) as EventsApiResponse;
      setEvents(Array.isArray(payload.data) ? payload.data : []);
      setWarnings(Array.isArray(payload.warnings) ? payload.warnings : []);
      if (!response.ok) setError("事件数据暂时不可用，页面已显示可用部分。");
    } catch {
      setEvents([]);
      setError("事件日历暂时不可用，请稍后再试。");
    } finally {
      setIsLoading(false);
    }
  }

  const filteredEvents = useMemo(() => {
    const normalizedSearch = search.trim().toUpperCase();
    return events.filter((event) => {
      const typeMatched = typeFilter === "all" || event.type === typeFilter;
      const importanceMatched = importanceFilter === "all" || event.importance === importanceFilter;
      const scopeMatched =
        scopeMode === "all" ||
        !event.symbol ||
        (scopeMode === "holdings" ? holdingSymbols.includes(event.symbol) : watchlistSymbols.includes(event.symbol));
      const searchMatched = !normalizedSearch || event.symbol?.includes(normalizedSearch) || event.title.toUpperCase().includes(normalizedSearch);
      return typeMatched && importanceMatched && scopeMatched && searchMatched;
    });
  }, [events, holdingSymbols, importanceFilter, scopeMode, search, typeFilter, watchlistSymbols]);

  const groupedEvents = useMemo(() => groupEventsByDate(filteredEvents), [filteredEvents]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Event Calendar V2"
        eyebrow="真实事件日历"
        description="公司财报、除息日与官方宏观经济事件。所有事件显示来源、更新时间和确认状态。"
        action={
          <button onClick={loadCalendar} className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
            刷新日历
          </button>
        }
      />

      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <div className="grid gap-3 lg:grid-cols-[auto_auto_1fr_auto] lg:items-end">
          <SegmentedControl
            label="范围"
            value={rangeMode}
            options={[
              { value: "today", label: "今天" },
              { value: "7d", label: "未来7天" },
              { value: "30d", label: "未来30天" }
            ]}
            onChange={(value) => setRangeMode(value as RangeMode)}
          />
          <SegmentedControl
            label="视图"
            value={viewMode}
            options={[
              { value: "month", label: "月视图" },
              { value: "list", label: "列表视图" }
            ]}
            onChange={(value) => setViewMode(value as ViewMode)}
          />
          <label className="text-sm">
            <span className="font-medium text-ink">股票代码搜索</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} className="mt-1 w-full rounded-md border border-line bg-panel px-3 py-2 outline-none focus:border-signal" placeholder="TSLA / NVDA / META" />
          </label>
          <p className="text-sm text-muted">{isLoading ? "正在加载事件..." : `当前显示 ${filteredEvents.length} 条`}</p>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <SelectFilter label="事件类型" value={typeFilter} options={eventTypes.map((item) => ({ value: item.type, label: item.label }))} onChange={(value) => setTypeFilter(value as EventType | "all")} />
          <SelectFilter label="重要性" value={importanceFilter} options={importanceFilters} onChange={(value) => setImportanceFilter(value as EventImportance | "all")} />
          <SelectFilter
            label="关联范围"
            value={scopeMode}
            options={[
              { value: "all", label: "全部事件" },
              { value: "holdings", label: "只看持仓" },
              { value: "watchlist", label: "只看自选股" }
            ]}
            onChange={(value) => setScopeMode(value as ScopeMode)}
          />
        </div>
      </section>

      {warnings.length ? <p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">{warnings.join("；")}</p> : null}
      {error ? <p className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700">{error}</p> : null}

      {isLoading ? (
        <p className="rounded-lg border border-line bg-white p-5 text-sm text-muted shadow-soft">正在加载事件日历...</p>
      ) : filteredEvents.length === 0 ? (
        <p className="rounded-lg border border-line bg-white p-8 text-center text-sm text-muted shadow-soft">当前范围暂无事件。</p>
      ) : viewMode === "month" ? (
        <MonthView groups={groupedEvents} />
      ) : (
        <ListView groups={groupedEvents} />
      )}
    </div>
  );
}

function MonthView({ groups }: { groups: Array<{ date: string; events: MarketEvent[] }> }) {
  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {groups.map((group) => (
        <div key={group.date} className="rounded-lg border border-line bg-white p-4 shadow-soft">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-ink">{formatDate(group.date)}</h2>
            <span className="text-xs text-muted">{group.events.length} 条</span>
          </div>
          <div className="space-y-3">
            {group.events.map((event) => <EventCard key={event.id} event={event} compact />)}
          </div>
        </div>
      ))}
    </section>
  );
}

function ListView({ groups }: { groups: Array<{ date: string; events: MarketEvent[] }> }) {
  return (
    <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
      <div className="space-y-5">
        {groups.map((group) => (
          <div key={group.date} className="grid gap-3 border-l-2 border-signal pl-4 md:grid-cols-[140px_1fr]">
            <div>
              <p className="font-semibold text-ink">{formatDate(group.date)}</p>
              <p className="text-xs text-muted">{group.events.length} 个事件</p>
            </div>
            <div className="grid gap-3">
              {group.events.map((event) => <EventCard key={event.id} event={event} />)}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function EventCard({ event, compact = false }: { event: MarketEvent; compact?: boolean }) {
  return (
    <article className={`rounded-md border p-4 ${getEventCardClass(event.type)}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-muted">{getTypeLabel(event.type)} · {formatEventTime(event)}</p>
          <h3 className="mt-1 font-semibold text-ink">{event.title}</h3>
          {event.symbol ? <p className="mt-1 text-sm text-muted">{event.symbol}{event.companyName ? ` · ${event.companyName}` : ""}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <span className={`rounded-md px-2 py-1 text-xs font-semibold ${getImportanceBadgeClass(event.importance)}`}>{getImportanceLabel(event.importance)}</span>
          <span className={`rounded-md px-2 py-1 text-xs font-semibold ${event.dateStatus === "confirmed" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-800"}`}>{event.dateStatus === "confirmed" ? "日期已确认" : "预计日期"}</span>
        </div>
      </div>
      {event.description && !compact ? <p className="mt-3 text-sm leading-6 text-muted">{event.description}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted">
        <span>{getSourceLabel(event)}</span>
        <span>更新：{formatUpdatedAt(event.updatedAt)}</span>
        {event.isStale ? <span className="font-semibold text-amber-700">数据可能已过期</span> : null}
        {event.source === "unavailable" ? <span className="font-semibold text-red-700">数据暂时不可用</span> : null}
      </div>
    </article>
  );
}

function SegmentedControl({ label, value, options, onChange }: { label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) {
  return (
    <div>
      <p className="mb-1 text-sm font-medium text-ink">{label}</p>
      <div className="flex rounded-md border border-line bg-panel p-1">
        {options.map((option) => (
          <button key={option.value} type="button" onClick={() => onChange(option.value)} className={`rounded px-3 py-1.5 text-sm font-semibold ${value === option.value ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"}`}>
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function SelectFilter({ label, value, options, onChange }: { label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) {
  return (
    <label className="text-sm">
      <span className="font-medium text-ink">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-md border border-line bg-panel px-3 py-2 outline-none focus:border-signal">
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

function groupEventsByDate(events: MarketEvent[]) {
  const map = new Map<string, MarketEvent[]>();
  events.forEach((event) => {
    const date = event.startAt.slice(0, 10);
    map.set(date, [...(map.get(date) ?? []), event]);
  });
  return Array.from(map.entries()).map(([date, groupEvents]) => ({ date, events: groupEvents }));
}

function getRange(mode: RangeMode) {
  const today = new Date();
  const days = mode === "today" ? 0 : mode === "7d" ? 7 : 30;
  return { from: toDateString(today), to: toDateString(addDays(today, days)) };
}

function getSymbols(items: Array<{ ticker?: string | null }>) {
  return Array.from(new Set(items.map((item) => item.ticker?.trim().toUpperCase()).filter(Boolean) as string[]));
}

function formatDate(date: string) {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric", weekday: "short" }).format(parsed);
}

function formatEventTime(event: MarketEvent) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(event.startAt)) return "全天";
  const parsed = new Date(event.startAt);
  if (Number.isNaN(parsed.getTime())) return "全天";
  return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }).format(parsed);
}

function formatUpdatedAt(value: string | null) {
  if (!value) return "--";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "--";
  return new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(parsed);
}

function getTypeLabel(type: EventType) {
  if (type === "earnings") return "财报";
  if (type === "dividend") return "除息";
  if (type === "fomc") return "FOMC";
  if (type === "cpi") return "CPI";
  if (type === "ppi") return "PPI";
  if (type === "nonfarm-payrolls") return "非农";
  if (type === "gdp") return "GDP";
  return "其他";
}

function getImportanceLabel(importance: EventImportance) {
  if (importance === "high") return "高重要性";
  if (importance === "medium") return "中重要性";
  return "低重要性";
}

function getSourceLabel(event: MarketEvent) {
  if (event.source === "fmp") return "真实数据 · FMP";
  if (event.source === "federal-reserve") return "官方数据 · Federal Reserve";
  if (event.source === "bls") return "官方数据 · BLS";
  if (event.source === "bea") return "官方数据 · BEA";
  if (event.source === "cache") return "缓存数据";
  if (event.source === "stale-cache") return "过期缓存";
  if (event.source === "unavailable") return "数据暂时不可用";
  return `官方数据 · ${event.sourceName}`;
}

function getEventCardClass(type: EventType) {
  if (type === "earnings") return "border-blue-200 bg-blue-50";
  if (type === "dividend") return "border-green-200 bg-green-50";
  if (type === "fomc") return "border-red-200 bg-red-50";
  if (type === "cpi" || type === "ppi") return "border-amber-200 bg-amber-50";
  if (type === "nonfarm-payrolls") return "border-purple-200 bg-purple-50";
  if (type === "gdp") return "border-sky-200 bg-sky-50";
  return "border-line bg-panel";
}

function getImportanceBadgeClass(importance: EventImportance) {
  if (importance === "high") return "bg-red-100 text-red-700";
  if (importance === "medium") return "bg-amber-100 text-amber-800";
  return "bg-slate-100 text-slate-600";
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toDateString(date: Date) {
  return date.toISOString().slice(0, 10);
}
