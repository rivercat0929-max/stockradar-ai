import type { FundamentalMetric, FundamentalPeriod } from "@/lib/fundamentals/sec/types";

export function calculateQuality(quarterly: FundamentalPeriod[], annual: FundamentalPeriod[]) {
  const latest = quarterly[0] ?? annual[0] ?? null;
  const previousAnnual = annual[1] ?? null;
  return {
    freeCashFlow: direct(latest, "freeCashFlow"),
    freeCashFlowMargin: ratio(latest?.freeCashFlow, latest?.revenue, latest, "FCF ÷ revenue"),
    operatingCashFlowToNetIncome: ratio(latest?.operatingCashFlow, latest?.netIncome, latest, "Operating cash flow ÷ net income"),
    grossMargin: ratio(latest?.grossProfit, latest?.revenue, latest, "Gross profit ÷ revenue"),
    operatingMargin: ratio(latest?.operatingIncome, latest?.revenue, latest, "Operating income ÷ revenue"),
    roe: ratio(latest?.netIncome, latest?.equity, latest, "Net income ÷ equity"),
    debtToAssets: ratio(latest?.liabilities, latest?.assets, latest, "Liabilities ÷ assets"),
    netCash: netCash(latest),
    shareDilution: shareDilution(latest, previousAnnual)
  };
}

function direct(period: FundamentalPeriod | null, field: keyof FundamentalPeriod): FundamentalMetric {
  const value = numberOrNull(period?.[field]);
  if (!period || value === null) return missing("指标数据缺失");
  return metric(value, [period], String(field));
}

function ratio(numerator: unknown, denominator: unknown, period: FundamentalPeriod | null, formula: string): FundamentalMetric {
  const n = numberOrNull(numerator);
  const d = numberOrNull(denominator);
  if (!period || n === null || d === null || d === 0) return missing("分子或分母缺失");
  return metric((n / d) * 100, [period], formula);
}

function netCash(period: FundamentalPeriod | null): FundamentalMetric {
  if (!period || period.cash === null || period.liabilities === null) return missing("现金或负债数据缺失");
  return metric(period.cash - period.liabilities, [period], "cash - liabilities");
}

function shareDilution(current: FundamentalPeriod | null, prior: FundamentalPeriod | null): FundamentalMetric {
  if (!current || !prior || current.sharesOutstanding === null || prior.sharesOutstanding === null || prior.sharesOutstanding === 0) return missing("股本数据不足");
  return metric(((current.sharesOutstanding - prior.sharesOutstanding) / prior.sharesOutstanding) * 100, [current, prior], "shares outstanding change");
}

function metric(value: number, periods: FundamentalPeriod[], formula: string): FundamentalMetric {
  if (!Number.isFinite(value)) return missing("计算结果不可用");
  return { value: round(value), source: "calculated", periodsUsed: periods.map((item) => `${item.form} ${item.periodEnd}`), confidence: "high", missingReason: null, formula };
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
