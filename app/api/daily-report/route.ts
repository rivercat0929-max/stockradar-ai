import { generateRadarAlertsV2 } from "@/lib/alerts-v2";
import { getMarketEvents, type MarketEvent } from "@/lib/events";
import { buildDailyReport, buildEmptyDailyReport, type CalendarEvent, type EventCalendarResult } from "@/lib/daily-report";
import type { Holding } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const holdings = await loadHoldings(request);
    const alerts = await generateRadarAlertsV2({ tickers: [], holdings });
    const symbols = Array.from(new Set(holdings.map((holding) => holding.ticker.trim().toUpperCase()).filter(Boolean)));
    const eventResult = await getMarketEvents({ symbols });
    const calendar = toDailyReportCalendar(eventResult.events, eventResult.warnings);

    return Response.json(buildDailyReport({ holdings, alerts, calendar }));
  } catch (error) {
    console.error("GET /api/daily-report failed", error);
    return Response.json(
      buildEmptyDailyReport("每日报告暂时无法读取完整数据，已生成空白预览结构。")
    );
  }
}

function toDailyReportCalendar(events: MarketEvent[], warnings: string[]): EventCalendarResult {
  const timeline = events.map(toLegacyCalendarEvent);
  const today = new Date().toISOString().slice(0, 10);
  return {
    todayEvents: timeline.filter((event) => event.date === today),
    highRiskEvents: timeline.filter((event) => event.riskLevel === "高").slice(0, 8),
    nextFomc: timeline.find((event) => event.type === "fomc") ?? null,
    timeline,
    holdingEvents: timeline.filter((event) => event.isHoldingEvent),
    dataSources: {
      real: events.filter((event) => event.source === "fmp").map((event) => event.title),
      fallback: events.filter((event) => event.source === "federal-reserve" || event.source === "bls" || event.source === "bea" || event.source === "manual-official").map((event) => event.title),
      mock: []
    },
    errors: warnings
  };
}

function toLegacyCalendarEvent(event: MarketEvent): CalendarEvent {
  return {
    id: event.id,
    date: event.startAt.slice(0, 10),
    ticker: event.symbol ?? undefined,
    type: toLegacyEventType(event),
    title: event.title,
    description: event.description ?? "",
    riskLevel: event.importance === "high" ? "高" : event.importance === "medium" ? "中" : "低",
    impact: "中性",
    aiAnalysis: event.dateStatus === "confirmed" ? "日期已确认，建议提前检查仓位和风险计划。" : "预计日期，仅供复盘和观察使用。",
    isHoldingEvent: Boolean(event.symbol),
    source: event.source === "fmp" ? "real" : "fallback"
  };
}

function toLegacyEventType(event: MarketEvent): CalendarEvent["type"] {
  if (event.type === "nonfarm-payrolls") return "nonfarm";
  if (event.type === "ppi") return "cpi";
  if (event.type === "gdp" || event.type === "other") return "fomc";
  return event.type;
}

async function loadHoldings(request: Request) {
  try {
    const response = await fetch(new URL("/api/holdings", request.url), { cache: "no-store", headers: { cookie: request.headers.get("cookie") ?? "" } });
    const data = await response.json();
    return Array.isArray(data?.data) ? (data.data as Holding[]) : Array.isArray(data) ? (data as Holding[]) : [];
  } catch {
    return [];
  }
}
