import type { Holding } from "@/lib/types";

export type CalendarEventType = "earnings" | "dividend" | "split" | "product" | "fomc" | "cpi" | "nonfarm";
export type CalendarRiskLevel = "低" | "中" | "高";
export type CalendarImpact = "正面" | "中性" | "负面";
export type CalendarDataSource = "real" | "fallback" | "mock";

export type CalendarEvent = {
  id: string;
  date: string;
  ticker?: string;
  accountName?: string;
  type: CalendarEventType;
  title: string;
  description: string;
  riskLevel: CalendarRiskLevel;
  impact: CalendarImpact;
  aiAnalysis: string;
  isHoldingEvent: boolean;
  source: CalendarDataSource;
};

export type EventCalendarResult = {
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

const eventWindowDays = 30;

export async function buildEventCalendar(holdings: Holding[], requestUrl: string): Promise<EventCalendarResult> {
  const now = new Date();
  const end = addDays(now, eventWindowDays);
  const tickers = Array.from(new Set(holdings.map((holding) => holding.ticker.trim().toUpperCase()).filter(Boolean)));
  const errors: string[] = [];
  const realEvents = await getFmpEvents({ tickers, start: now, end, errors });
  const fallbackEvents = getFallbackEvents({ holdings, start: now });
  const events = mergeEvents([...realEvents, ...fallbackEvents]).sort((a, b) => a.date.localeCompare(b.date));

  return {
    todayEvents: events.filter((event) => isSameDay(new Date(event.date), now)),
    highRiskEvents: events.filter((event) => event.riskLevel === "高").slice(0, 8),
    nextFomc: events.find((event) => event.type === "fomc") ?? null,
    timeline: events,
    holdingEvents: events.filter((event) => event.isHoldingEvent),
    dataSources: {
      real: realEvents.map((event) => event.title),
      fallback: fallbackEvents.filter((event) => event.source === "fallback").map((event) => event.title),
      mock: fallbackEvents.filter((event) => event.source === "mock").map((event) => event.title)
    },
    errors
  };
}

async function getFmpEvents({
  tickers,
  start,
  end,
  errors
}: {
  tickers: string[];
  start: Date;
  end: Date;
  errors: string[];
}) {
  const apiKey = process.env.FMP_API_KEY;
  if (!apiKey || tickers.length === 0) return [];

  const from = toDateString(start);
  const to = toDateString(end);
  const events: CalendarEvent[] = [];

  await Promise.all([
    fetchFmpCalendar({
      url: getFmpCalendarUrl("earnings-calendar", from, to, apiKey),
      tickers,
      errors,
      mapItem: (item) => toFmpEarningsEvent(item)
    }),
    fetchFmpCalendar({
      url: getFmpCalendarUrl("dividends-calendar", from, to, apiKey),
      tickers,
      errors,
      mapItem: (item) => toFmpDividendEvent(item)
    }),
    fetchFmpCalendar({
      url: getFmpCalendarUrl("splits-calendar", from, to, apiKey),
      tickers,
      errors,
      mapItem: (item) => toFmpSplitEvent(item)
    })
  ]).then((groups) => {
    groups.forEach((group) => events.push(...group));
  });

  return events;
}

async function fetchFmpCalendar({
  url,
  tickers,
  errors,
  mapItem
}: {
  url: string;
  tickers: string[];
  errors: string[];
  mapItem: (item: Record<string, unknown>) => CalendarEvent | null;
}) {
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      errors.push(`FMP 日历接口返回 ${response.status}`);
      return [];
    }

    const data = await response.json();
    if (!Array.isArray(data)) return [];

    return data
      .filter((item) => {
        const symbol = getString(item.symbol ?? item.ticker).toUpperCase();
        return tickers.includes(symbol);
      })
      .flatMap((item) => {
        const event = mapItem(item);
        return event ? [event] : [];
      });
  } catch {
    errors.push("FMP 日历接口暂时不可用");
    return [];
  }
}

function getFallbackEvents({ holdings, start }: { holdings: Holding[]; start: Date }) {
  const events: CalendarEvent[] = [];
  const tickers = Array.from(new Set(holdings.map((holding) => holding.ticker.trim().toUpperCase()).filter(Boolean)));
  const uniqueHoldings = new Map<string, Holding>();
  holdings.forEach((holding) => {
    const ticker = holding.ticker.trim().toUpperCase();
    if (!uniqueHoldings.has(ticker)) uniqueHoldings.set(ticker, holding);
  });

  events.push(...getMacroEvents(start));

  Array.from(uniqueHoldings.values()).forEach((holding, index) => {
    const ticker = holding.ticker.trim().toUpperCase();
    events.push({
      id: `fallback-earnings-${ticker}`,
      date: toDateString(addDays(start, 7 + (index % 4) * 5)),
      ticker,
      accountName: holding.account?.name,
      type: "earnings",
      title: `${ticker} 财报日期待确认`,
      description: "暂无财报日期",
      riskLevel: "中",
      impact: "中性",
      aiAnalysis: "真实财报日期暂未取得，建议在财报季前保持仓位纪律。",
      isHoldingEvent: true,
      source: "mock"
    });
  });

  if (tickers.includes("TSLA")) {
    events.push({
      id: "mock-product-tsla",
      date: toDateString(addDays(start, 14)),
      ticker: "TSLA",
      type: "product",
      title: "TSLA 产品发布会观察窗口",
      description: "产品发布信息为本地 mock，占位用于提醒关注。",
      riskLevel: "中",
      impact: "中性",
      aiAnalysis: "产品发布可能提升情绪，但实际影响取决于交付、毛利率和市场预期。",
      isHoldingEvent: true,
      source: "mock"
    });
  }

  return events;
}

function getMacroEvents(start: Date): CalendarEvent[] {
  return [
    makeMacroEvent(start, 2, "cpi", "CPI 通胀数据公布", "通胀数据可能影响利率预期和成长股估值。", "高", "中性"),
    makeMacroEvent(start, 5, "nonfarm", "非农就业数据公布", "就业数据会影响市场对经济韧性和降息节奏的判断。", "高", "中性"),
    makeMacroEvent(start, 13, "fomc", "FOMC 利率会议", "利率声明和点阵图可能引发市场波动。", "高", "中性"),
    makeMacroEvent(start, 27, "fomc", "FOMC 会议纪要", "会议纪要可能改变市场对政策路径的理解。", "中", "中性")
  ];
}

function makeMacroEvent(start: Date, offsetDays: number, type: CalendarEventType, title: string, description: string, riskLevel: CalendarRiskLevel, impact: CalendarImpact): CalendarEvent {
  return {
    id: `fallback-${type}-${offsetDays}`,
    date: toDateString(addDays(start, offsetDays)),
    type,
    title,
    description,
    riskLevel,
    impact,
    aiAnalysis: getAiAnalysis(type, riskLevel, impact),
    isHoldingEvent: false,
    source: "fallback"
  };
}

function toFmpEarningsEvent(item: Record<string, unknown>): CalendarEvent | null {
  const ticker = getString(item.symbol ?? item.ticker).toUpperCase();
  const date = getString(item.date ?? item.reportDate);
  if (!ticker || !date) return null;
  return {
    id: `real-earnings-${ticker}-${date}`,
    date,
    ticker,
    type: "earnings",
    title: `${ticker} 财报`,
    description: "FMP 财报日历数据",
    riskLevel: "高",
    impact: "中性",
    aiAnalysis: "财报可能带来价格跳空和波动放大，建议提前检查仓位和止损计划。",
    isHoldingEvent: true,
    source: "real"
  };
}

function toFmpDividendEvent(item: Record<string, unknown>): CalendarEvent | null {
  const ticker = getString(item.symbol ?? item.ticker).toUpperCase();
  const date = getString(item.date ?? item.recordDate ?? item.paymentDate);
  if (!ticker || !date) return null;
  return {
    id: `real-dividend-${ticker}-${date}`,
    date,
    ticker,
    type: "dividend",
    title: `${ticker} 除息日`,
    description: "FMP 股息日历数据",
    riskLevel: "低",
    impact: "中性",
    aiAnalysis: "除息日前后价格可能出现机械性调整，长期影响通常有限。",
    isHoldingEvent: true,
    source: "real"
  };
}

function toFmpSplitEvent(item: Record<string, unknown>): CalendarEvent | null {
  const ticker = getString(item.symbol ?? item.ticker).toUpperCase();
  const date = getString(item.date ?? item.executionDate);
  if (!ticker || !date) return null;
  return {
    id: `real-split-${ticker}-${date}`,
    date,
    ticker,
    type: "split",
    title: `${ticker} 股票拆分`,
    description: "FMP 拆分日历数据",
    riskLevel: "中",
    impact: "中性",
    aiAnalysis: "股票拆分不改变基本面，但可能改善流动性并影响短期情绪。",
    isHoldingEvent: true,
    source: "real"
  };
}

function getAiAnalysis(type: CalendarEventType, riskLevel: CalendarRiskLevel, impact: CalendarImpact) {
  if (riskLevel === "高") return "该事件可能显著影响市场波动，建议提前控制仓位并避免过度集中。";
  if (type === "dividend") return "该事件多为中性，主要影响现金流和短期价格调整。";
  if (impact === "正面") return "该事件可能改善市场情绪，但仍需等待实际数据确认。";
  if (impact === "负面") return "该事件可能压制风险偏好，建议关注下行保护。";
  return "该事件影响偏中性，建议结合市场反应再调整计划。";
}

function mergeEvents(events: CalendarEvent[]) {
  const map = new Map<string, CalendarEvent>();
  events.forEach((event) => {
    if (!map.has(event.id)) map.set(event.id, event);
  });
  return Array.from(map.values());
}

function getFmpCalendarUrl(endpoint: string, from: string, to: string, apiKey: string) {
  const url = new URL(`https://financialmodelingprep.com/stable/${endpoint}`);
  url.searchParams.set("from", from);
  url.searchParams.set("to", to);
  url.searchParams.set("apikey", apiKey);
  return url.toString();
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function toDateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getString(value: unknown) {
  return typeof value === "string" ? value : "";
}
