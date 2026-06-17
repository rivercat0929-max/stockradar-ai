"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";

type CalendarEvent = {
  id: string;
  date: string;
  ticker?: string;
  accountName?: string;
  type: "earnings" | "dividend" | "split" | "product" | "fomc" | "cpi" | "nonfarm";
  title: string;
  description: string;
  riskLevel: "低" | "中" | "高";
  impact: "正面" | "中性" | "负面";
  aiAnalysis: string;
  isHoldingEvent: boolean;
  source: "real" | "fallback" | "mock";
};

type EventCalendarResult = {
  todayEvents: CalendarEvent[];
  highRiskEvents: CalendarEvent[];
  nextFomc: CalendarEvent | null;
  timeline: CalendarEvent[];
  holdingEvents: CalendarEvent[];
  dataSources: {
    real: string[];
    fallback: string[];
    mock: string[];
  };
  errors: string[];
};

export default function CalendarPage() {
  const [data, setData] = useState<EventCalendarResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const groupedTimeline = useMemo(() => groupEventsByDate(data?.timeline ?? []), [data]);

  useEffect(() => {
    loadCalendar();
  }, []);

  async function loadCalendar() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/calendar", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "事件日历暂时不可用。");
      setData(payload);
      if (Array.isArray(payload.errors) && payload.errors.length) {
        setError("部分真实数据源暂时不可用，已使用 fallback/mock 数据继续生成日历。");
      }
    } catch {
      setError("事件日历暂时不可用，请稍后再试。");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Event Calendar V1"
        eyebrow="事件日历"
        description="未来30天公司财报、除息日、拆分、产品发布会和宏观事件提醒。"
        action={
          <button onClick={loadCalendar} className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
            刷新日历
          </button>
        }
      />

      {isLoading ? <p className="rounded-lg border border-line bg-white p-5 text-sm text-muted shadow-soft">正在加载事件日历...</p> : null}
      {error ? <p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">{error}</p> : null}

      {data ? (
        <>
          <section className="grid gap-4 lg:grid-cols-3">
            <SummaryPanel title="今日事件" emptyText="今天暂无重要事件" events={data.todayEvents} />
            <SummaryPanel title="高风险事件" emptyText="暂无高风险事件" events={data.highRiskEvents.slice(0, 3)} />
            <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
              <h2 className="text-lg font-semibold">下次 FOMC</h2>
              {data.nextFomc ? <EventCard event={data.nextFomc} compact /> : <p className="mt-4 rounded-md border border-line bg-panel p-4 text-sm text-muted">未来30天暂无 FOMC 事件。</p>}
            </section>
          </section>

          <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">我的持仓事件专区</h2>
              <p className="text-xs text-muted">包含当前持仓相关的财报、除息日、拆分和产品事件。</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {data.holdingEvents.length ? data.holdingEvents.map((event) => <EventCard key={event.id} event={event} />) : <p className="rounded-md border border-line bg-panel p-4 text-sm text-muted md:col-span-2">暂无持仓相关事件。</p>}
            </div>
          </section>

          <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">未来30天时间轴</h2>
              <p className="text-xs text-muted">
                真实：{data.dataSources.real.length} / Fallback：{data.dataSources.fallback.length} / Mock：{data.dataSources.mock.length}
              </p>
            </div>
            <div className="space-y-5">
              {groupedTimeline.length ? (
                groupedTimeline.map((group) => (
                  <div key={group.date} className="grid gap-3 border-l-2 border-signal pl-4 md:grid-cols-[140px_1fr]">
                    <div>
                      <p className="font-semibold text-ink">{formatDate(group.date)}</p>
                      <p className="text-xs text-muted">{group.events.length} 个事件</p>
                    </div>
                    <div className="grid gap-3">
                      {group.events.map((event) => (
                        <EventCard key={event.id} event={event} compact />
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <p className="rounded-md border border-line bg-panel p-4 text-sm text-muted">未来30天暂无事件。</p>
              )}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}

function SummaryPanel({ title, emptyText, events }: { title: string; emptyText: string; events: CalendarEvent[] }) {
  return (
    <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-4 space-y-3">
        {events.length ? events.map((event) => <EventCard key={event.id} event={event} compact />) : <p className="rounded-md border border-line bg-panel p-4 text-sm text-muted">{emptyText}</p>}
      </div>
    </section>
  );
}

function EventCard({ event, compact = false }: { event: CalendarEvent; compact?: boolean }) {
  return (
    <article className={`rounded-md border p-4 ${getRiskCardClass(event.riskLevel)}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-muted">{getTypeLabel(event.type)} / {getSourceLabel(event.source)}</p>
          <h3 className="mt-1 font-semibold text-ink">{event.title}</h3>
        </div>
        <div className="flex gap-2">
          <span className={`rounded-md px-2 py-1 text-xs font-semibold ${getRiskBadgeClass(event.riskLevel)}`}>{event.riskLevel}风险</span>
          <span className={`rounded-md px-2 py-1 text-xs font-semibold ${getImpactBadgeClass(event.impact)}`}>{event.impact}</span>
        </div>
      </div>
      <p className="mt-2 text-sm text-muted">{event.description}</p>
      {!compact ? <p className="mt-3 rounded-md bg-white/70 px-3 py-2 text-sm text-muted">AI影响分析：{event.aiAnalysis}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted">
        <span>{formatDate(event.date)}</span>
        {event.ticker ? <span>{event.ticker}</span> : null}
        {event.accountName ? <span>{event.accountName}</span> : null}
      </div>
    </article>
  );
}

function groupEventsByDate(events: CalendarEvent[]) {
  const map = new Map<string, CalendarEvent[]>();
  events.forEach((event) => {
    map.set(event.date, [...(map.get(event.date) ?? []), event]);
  });
  return Array.from(map.entries()).map(([date, groupEvents]) => ({ date, events: groupEvents }));
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric", weekday: "short" }).format(new Date(`${date}T00:00:00`));
}

function getTypeLabel(type: CalendarEvent["type"]) {
  if (type === "earnings") return "财报";
  if (type === "dividend") return "除息日";
  if (type === "split") return "股票拆分";
  if (type === "product") return "产品发布会";
  if (type === "fomc") return "FOMC";
  if (type === "cpi") return "CPI";
  return "非农";
}

function getSourceLabel(source: CalendarEvent["source"]) {
  if (source === "real") return "真实数据";
  if (source === "fallback") return "Fallback";
  return "Mock";
}

function getRiskCardClass(riskLevel: CalendarEvent["riskLevel"]) {
  if (riskLevel === "高") return "border-red-200 bg-red-50";
  if (riskLevel === "中") return "border-amber-200 bg-amber-50";
  return "border-line bg-panel";
}

function getRiskBadgeClass(riskLevel: CalendarEvent["riskLevel"]) {
  if (riskLevel === "高") return "bg-red-100 text-red-700";
  if (riskLevel === "中") return "bg-amber-100 text-amber-800";
  return "bg-slate-100 text-slate-600";
}

function getImpactBadgeClass(impact: CalendarEvent["impact"]) {
  if (impact === "正面") return "bg-green-100 text-green-700";
  if (impact === "负面") return "bg-red-100 text-red-700";
  return "bg-blue-100 text-blue-700";
}
