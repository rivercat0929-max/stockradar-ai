import type { FundamentalMetric, FundamentalPeriod } from "@/lib/fundamentals/sec/types";

export function calculateGrowth(quarterly: FundamentalPeriod[], annual: FundamentalPeriod[]) {
  const q = [...quarterly].sort((a, b) => b.periodEnd.localeCompare(a.periodEnd));
  const a = [...annual].sort((x, y) => y.periodEnd.localeCompare(x.periodEnd));
  return {
    revenueYoY: yoy(q, "revenue"),
    netIncomeYoY: yoy(q, "netIncome"),
    epsYoY: yoy(q, "epsDiluted"),
    freeCashFlowYoY: yoy(q, "freeCashFlow"),
    revenueCagr3y: cagr(a, "revenue"),
    epsCagr3y: cagr(a, "epsDiluted"),
    ttmRevenue: ttm(q, "revenue"),
    ttmNetIncome: ttm(q, "netIncome"),
    ttmFreeCashFlow: ttm(q, "freeCashFlow")
  };
}

function yoy(periods: FundamentalPeriod[], field: keyof FundamentalPeriod): FundamentalMetric {
  const current = periods[0];
  const prior = periods.find((item) => item.fiscalQuarter === current?.fiscalQuarter && item.fiscalYear === (current?.fiscalYear ?? 0) - 1);
  const currentValue = numberOrNull(current?.[field]);
  const priorValue = numberOrNull(prior?.[field]);
  if (!current || !prior || currentValue === null || priorValue === null || priorValue === 0) return missing("同比数据不足");
  return metric(((currentValue - priorValue) / Math.abs(priorValue)) * 100, [current, prior], `${String(field)} YoY`);
}

function cagr(periods: FundamentalPeriod[], field: keyof FundamentalPeriod): FundamentalMetric {
  const current = periods[0];
  const prior = periods[3];
  const currentValue = numberOrNull(current?.[field]);
  const priorValue = numberOrNull(prior?.[field]);
  if (!current || !prior || currentValue === null || priorValue === null || currentValue <= 0 || priorValue <= 0) return missing("3年CAGR数据不足或跨越负数");
  return metric((Math.pow(currentValue / priorValue, 1 / 3) - 1) * 100, [current, prior], `${String(field)} 3Y CAGR`);
}

function ttm(periods: FundamentalPeriod[], field: keyof FundamentalPeriod): FundamentalMetric {
  const selected = periods.slice(0, 4);
  const values = selected.map((item) => numberOrNull(item[field]));
  if (selected.length < 4 || values.some((value) => value === null)) return missing("最近4季度数据不足");
  const numericValues = values.filter((value): value is number => value !== null);
  return metric(numericValues.reduce((sum, value) => sum + value, 0), selected, `${String(field)} TTM`);
}

function metric(value: number, periods: FundamentalPeriod[], formula: string): FundamentalMetric {
  if (!Number.isFinite(value)) return missing("计算结果不可用");
  return {
    value: round(value),
    source: "calculated",
    periodsUsed: periods.map((item) => `${item.form} ${item.fiscalYear ?? ""} ${item.fiscalQuarter ?? ""} ${item.periodEnd}`),
    confidence: periods.some((item) => item.form === "10-Q" || item.form === "10-K") ? "high" : "low",
    missingReason: null,
    formula
  };
}

function missing(reason: string): FundamentalMetric {
  return { value: null, source: "unavailable", periodsUsed: [], confidence: "insufficient", missingReason: reason };
}

function numberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
