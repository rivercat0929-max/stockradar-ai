import type { RadarAlertsV2Result, RadarAlertV2 } from "@/lib/alerts-v2";
import type { EventCalendarResult, CalendarEvent } from "@/lib/calendar";
import type { Holding } from "@/lib/types";

export type DailyReportDataSourceLabel = "真实数据" | "缓存数据" | "静态数据" | "示例数据";

export type DailyReportHoldingItem = {
  ticker: string;
  accountName: string;
  companyName: string;
  marketValue: number;
  unrealizedPL: number;
  unrealizedPLPercent: number;
  allocation: number;
  source: DailyReportDataSourceLabel;
};

export type DailyReportResult = {
  generatedAt: string;
  reportDate: string;
  summary: {
    holdingsCount: number;
    totalMarketValue: number;
    totalUnrealizedPL: number;
    totalReturnPercent: number;
    topGainers: DailyReportHoldingItem[];
    topLosers: DailyReportHoldingItem[];
  };
  alerts: {
    todayHighlights: RadarAlertV2[];
    holdingAlerts: RadarAlertV2[];
    source: DailyReportDataSourceLabel;
  };
  events: {
    nextSevenDays: CalendarEvent[];
    highRiskEvents: CalendarEvent[];
    source: DailyReportDataSourceLabel;
  };
  riskReminders: string[];
  aiCommentary: string;
  reportText: string;
  dataSources: Array<{
    name: string;
    source: DailyReportDataSourceLabel;
    detail: string;
  }>;
  emailProviders: Array<{
    name: "SendGrid" | "Gmail SMTP" | "Resend";
    status: "预留接口";
  }>;
  errors: string[];
};

export function buildDailyReport({
  holdings,
  alerts,
  calendar,
  errors = []
}: {
  holdings: Holding[];
  alerts: RadarAlertsV2Result;
  calendar: EventCalendarResult;
  errors?: string[];
}): DailyReportResult {
  const now = new Date();
  const reportDate = formatDateLong(now);
  const holdingItems = holdings.map(toHoldingItem);
  const totalMarketValue = roundMoney(holdingItems.reduce((sum, item) => sum + item.marketValue, 0));
  const totalCost = roundMoney(
    holdings.reduce((sum, holding) => sum + holding.shares * holding.averageCost, 0)
  );
  const totalUnrealizedPL = roundMoney(holdingItems.reduce((sum, item) => sum + item.unrealizedPL, 0));
  const totalReturnPercent = totalCost > 0 ? roundPercent((totalUnrealizedPL / totalCost) * 100) : 0;
  const topGainers = [...holdingItems].sort((a, b) => b.unrealizedPLPercent - a.unrealizedPLPercent).slice(0, 3);
  const topLosers = [...holdingItems].sort((a, b) => a.unrealizedPLPercent - b.unrealizedPLPercent).slice(0, 3);
  const nextSevenDays = getNextSevenDayEvents(calendar.timeline, now);
  const riskReminders = buildRiskReminders({ holdings: holdingItems, alerts, calendar, totalMarketValue });
  const aiCommentary = buildAiCommentary({ totalReturnPercent, riskReminders, alerts, nextSevenDays });
  const reportText = buildReportText({
    reportDate,
    totalMarketValue,
    totalUnrealizedPL,
    totalReturnPercent,
    topGainers,
    topLosers,
    alerts,
    nextSevenDays,
    riskReminders,
    aiCommentary
  });

  return {
    generatedAt: now.toISOString(),
    reportDate,
    summary: {
      holdingsCount: holdings.length,
      totalMarketValue,
      totalUnrealizedPL,
      totalReturnPercent,
      topGainers,
      topLosers
    },
    alerts: {
      todayHighlights: alerts.todayHighlights.slice(0, 6),
      holdingAlerts: alerts.holdingAlerts.slice(0, 6),
      source: getAlertSource(alerts)
    },
    events: {
      nextSevenDays,
      highRiskEvents: calendar.highRiskEvents.slice(0, 6),
      source: getCalendarSource(calendar)
    },
    riskReminders,
    aiCommentary,
    reportText,
    dataSources: buildDataSourceNotes(holdings, alerts, calendar),
    emailProviders: [
      { name: "SendGrid", status: "预留接口" },
      { name: "Gmail SMTP", status: "预留接口" },
      { name: "Resend", status: "预留接口" }
    ],
    errors: [
      ...errors,
      ...alerts.errors.map((item) => `${item.ticker}: ${item.error}`),
      ...calendar.errors
    ].filter(Boolean)
  };
}

export function buildEmptyDailyReport(error: string): DailyReportResult {
  const alerts: RadarAlertsV2Result = {
    todayHighlights: [],
    holdingAlerts: [],
    history: [],
    errors: [],
    dataSources: { real: [], fallback: [], mock: [] }
  };
  const calendar: EventCalendarResult = {
    todayEvents: [],
    highRiskEvents: [],
    nextFomc: null,
    timeline: [],
    holdingEvents: [],
    dataSources: { real: [], fallback: [], mock: [] },
    errors: []
  };

  return buildDailyReport({ holdings: [], alerts, calendar, errors: [error] });
}

function toHoldingItem(holding: Holding): DailyReportHoldingItem {
  const marketValue = roundMoney(holding.marketValue ?? holding.shares * (holding.currentPrice ?? holding.averageCost));
  const totalCost = roundMoney(holding.totalCost ?? holding.shares * holding.averageCost);
  const unrealizedPL = roundMoney(holding.unrealizedPL ?? marketValue - totalCost);
  const unrealizedPLPercent = totalCost > 0 ? roundPercent((unrealizedPL / totalCost) * 100) : holding.unrealizedPLPercent ?? 0;

  return {
    ticker: holding.ticker.trim().toUpperCase(),
    accountName: holding.account?.name ?? "未分账户",
    companyName: holding.companyName ?? holding.ticker.trim().toUpperCase(),
    marketValue,
    unrealizedPL,
    unrealizedPLPercent,
    allocation: holding.allocation ?? 0,
    source: getHoldingSource(holding)
  };
}

function buildRiskReminders({
  holdings,
  alerts,
  calendar,
  totalMarketValue
}: {
  holdings: DailyReportHoldingItem[];
  alerts: RadarAlertsV2Result;
  calendar: EventCalendarResult;
  totalMarketValue: number;
}) {
  const reminders: string[] = [];
  const largestHolding = [...holdings].sort((a, b) => b.marketValue - a.marketValue)[0];
  const highRiskAlerts = alerts.history.filter((alert) => alert.riskLevel === "high");

  if (largestHolding && totalMarketValue > 0) {
    const weight = (largestHolding.marketValue / totalMarketValue) * 100;
    if (weight >= 40) reminders.push(`${largestHolding.ticker} 仓位约 ${formatPercent(weight)}，单一持仓偏重。`);
  }

  if (highRiskAlerts.length) {
    reminders.push(`今日有 ${highRiskAlerts.length} 条高风险预警，优先检查止损和仓位计划。`);
  }

  if (calendar.highRiskEvents.length) {
    reminders.push(`未来事件中有 ${calendar.highRiskEvents.length} 个高风险节点，注意财报或宏观数据前后的波动。`);
  }

  const losingPositions = holdings.filter((holding) => holding.unrealizedPLPercent < 0);
  if (losingPositions.length) {
    reminders.push(`${losingPositions.length} 只持仓低于成本价，建议复核持仓理由是否仍成立。`);
  }

  if (!reminders.length) {
    reminders.push("当前未发现突出的集中风险，仍建议保持分散和现金缓冲。");
  }

  return reminders;
}

function buildAiCommentary({
  totalReturnPercent,
  riskReminders,
  alerts,
  nextSevenDays
}: {
  totalReturnPercent: number;
  riskReminders: string[];
  alerts: RadarAlertsV2Result;
  nextSevenDays: CalendarEvent[];
}) {
  const highRiskCount = alerts.history.filter((alert) => alert.riskLevel === "high").length;
  const eventCount = nextSevenDays.length;

  if (highRiskCount >= 3 || riskReminders.length >= 3) {
    return `组合今天更适合防守观察。当前收益率 ${formatPercent(totalReturnPercent)}，同时存在较多预警信号，建议先确认风险暴露，再考虑新增仓位。`;
  }

  if (eventCount >= 4) {
    return `未来7天事件较密集，组合可能受财报或宏观数据影响放大波动。当前收益率 ${formatPercent(totalReturnPercent)}，适合按计划分批处理。`;
  }

  if (totalReturnPercent > 0) {
    return `组合整体保持盈利，当前收益率 ${formatPercent(totalReturnPercent)}。可继续让强势持仓运行，但注意避免单一股票仓位过高。`;
  }

  return `组合当前收益率 ${formatPercent(totalReturnPercent)}，短期以风险控制和验证持仓逻辑为主，等待更清晰的价格和事件信号。`;
}

function buildReportText({
  reportDate,
  totalMarketValue,
  totalUnrealizedPL,
  totalReturnPercent,
  topGainers,
  topLosers,
  alerts,
  nextSevenDays,
  riskReminders,
  aiCommentary
}: {
  reportDate: string;
  totalMarketValue: number;
  totalUnrealizedPL: number;
  totalReturnPercent: number;
  topGainers: DailyReportHoldingItem[];
  topLosers: DailyReportHoldingItem[];
  alerts: RadarAlertsV2Result;
  nextSevenDays: CalendarEvent[];
  riskReminders: string[];
  aiCommentary: string;
}) {
  return [
    "StockRadar AI 每日投资雷达报告",
    `日期：${reportDate}`,
    "",
    "一、持仓涨跌",
    `组合总市值：${formatCurrency(totalMarketValue)}`,
    `浮动盈亏：${formatCurrency(totalUnrealizedPL)}（${formatPercent(totalReturnPercent)}）`,
    `表现较强：${formatHoldingLine(topGainers)}`,
    `表现较弱：${formatHoldingLine(topLosers)}`,
    "",
    "二、今日重点预警",
    formatAlertLines(alerts.todayHighlights),
    "",
    "三、未来7天事件",
    formatEventLines(nextSevenDays),
    "",
    "四、风险提醒",
    riskReminders.map((item) => `- ${item}`).join("\n"),
    "",
    "五、AI简评",
    aiCommentary,
    "",
    "数据来源说明：持仓来自本地数据库；行情优先使用 FMP，失败时使用 Yahoo、缓存或示例数据；高级预警和事件包含真实数据、fallback 数据与部分静态/示例规则。",
    "免责声明：本报告仅用于投资教育和研究，不构成财务建议。"
  ].join("\n");
}

function buildDataSourceNotes(holdings: Holding[], alerts: RadarAlertsV2Result, calendar: EventCalendarResult) {
  const hasRealHoldings = holdings.length > 0;
  const hasCachedHoldings = holdings.some((holding) => holding.marketDataSource === "yahoo");

  return [
    {
      name: "持仓数据",
      source: hasRealHoldings ? ("真实数据" as const) : ("示例数据" as const),
      detail: hasRealHoldings ? "来自当前 Holdings 数据库记录。" : "当前没有读取到持仓，报告使用空组合结构。"
    },
    {
      name: "行情数据",
      source: hasCachedHoldings ? ("缓存数据" as const) : ("真实数据" as const),
      detail: "优先使用 FMP stable quote；失败时由现有行情层使用 Yahoo、缓存或 mock 兜底。"
    },
    {
      name: "Radar Alerts V2",
      source: getAlertSource(alerts),
      detail: `真实 ${alerts.dataSources.real.length}，fallback ${alerts.dataSources.fallback.length}，示例 ${alerts.dataSources.mock.length}。`
    },
    {
      name: "Event Calendar",
      source: getCalendarSource(calendar),
      detail: `真实 ${calendar.dataSources.real.length}，fallback ${calendar.dataSources.fallback.length}，示例 ${calendar.dataSources.mock.length}。`
    },
    {
      name: "AI简评",
      source: "静态数据" as const,
      detail: "V1 使用本地规则模板生成，暂未接入真正邮件发送或大模型。"
    }
  ];
}

function getNextSevenDayEvents(events: CalendarEvent[], now: Date) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const end = new Date(today);
  end.setDate(end.getDate() + 7);

  return events
    .filter((event) => {
      const eventDate = new Date(`${event.date}T00:00:00`);
      return eventDate >= today && eventDate <= end;
    })
    .slice(0, 12);
}

function getHoldingSource(holding: Holding): DailyReportDataSourceLabel {
  if (holding.marketDataSource === "mock") return "示例数据";
  if (holding.marketDataSource === "yahoo") return "缓存数据";
  return "真实数据";
}

function getAlertSource(alerts: RadarAlertsV2Result): DailyReportDataSourceLabel {
  if (alerts.dataSources.real.length) return "真实数据";
  if (alerts.dataSources.fallback.length) return "缓存数据";
  if (alerts.dataSources.mock.length) return "示例数据";
  return "静态数据";
}

function getCalendarSource(calendar: EventCalendarResult): DailyReportDataSourceLabel {
  if (calendar.dataSources.real.length) return "真实数据";
  if (calendar.dataSources.fallback.length) return "静态数据";
  if (calendar.dataSources.mock.length) return "示例数据";
  return "静态数据";
}

function formatHoldingLine(items: DailyReportHoldingItem[]) {
  if (!items.length) return "暂无持仓数据";
  return items.map((item) => `${item.ticker} ${formatPercent(item.unrealizedPLPercent)}`).join("，");
}

function formatAlertLines(alerts: RadarAlertV2[]) {
  if (!alerts.length) return "- 今日暂无重点预警";
  return alerts.map((alert) => `- ${alert.ticker}：${alert.title}（${riskLabel(alert.riskLevel)}，${sourceLabel(alert.source)}）`).join("\n");
}

function formatEventLines(events: CalendarEvent[]) {
  if (!events.length) return "- 未来7天暂无重要事件";
  return events.map((event) => `- ${event.date}：${event.ticker ? `${event.ticker} ` : ""}${event.title}`).join("\n");
}

function riskLabel(riskLevel: RadarAlertV2["riskLevel"]) {
  if (riskLevel === "high") return "高风险";
  if (riskLevel === "medium") return "中风险";
  return "低风险";
}

function sourceLabel(source: RadarAlertV2["source"]) {
  if (source === "real") return "真实数据";
  if (source === "fallback") return "缓存/fallback数据";
  return "示例数据";
}

function formatDateLong(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "long" }).format(date);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 2 }).format(value);
}

function formatPercent(value: number) {
  return `${roundPercent(value).toFixed(1)}%`;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function roundPercent(value: number) {
  return Math.round(value * 10) / 10;
}
