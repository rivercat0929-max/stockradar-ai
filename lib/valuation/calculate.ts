import type { FundamentalMetric, FundamentalPeriod } from "@/lib/fundamentals/sec/types";

export function calculateValuation(input: {
  price: number | null;
  sharesOutstanding: number | null;
  ttmRevenue: FundamentalMetric;
  ttmNetIncome: FundamentalMetric;
  ttmFreeCashFlow: FundamentalMetric;
  latestPeriod: FundamentalPeriod | null;
  priceSource: string;
}) {
  const marketCap = input.price !== null && input.sharesOutstanding !== null ? input.price * input.sharesOutstanding : null;
  return {
    marketCap: metric(marketCap, "当前价 × 流通股数", input.priceSource),
    pe: valuationRatio(marketCap, input.ttmNetIncome.value, "市值 ÷ TTM净利润", input.ttmNetIncome.periodsUsed),
    ps: valuationRatio(marketCap, input.ttmRevenue.value, "市值 ÷ TTM收入", input.ttmRevenue.periodsUsed),
    pfcf: valuationRatio(marketCap, input.ttmFreeCashFlow.value, "市值 ÷ TTM自由现金流", input.ttmFreeCashFlow.periodsUsed),
    pb: valuationRatio(marketCap, input.latestPeriod?.equity ?? null, "市值 ÷ 股东权益", input.latestPeriod ? [`${input.latestPeriod.form} ${input.latestPeriod.periodEnd}`] : [])
  };
}

function valuationRatio(marketCap: number | null, denominator: number | null, formula: string, periodsUsed: string[]): FundamentalMetric {
  if (marketCap === null || denominator === null || denominator <= 0) return missing("市值或正向分母缺失", formula);
  return { value: round(marketCap / denominator), source: "calculated", periodsUsed, confidence: "high", missingReason: null, formula };
}

function metric(value: number | null, formula: string, source: string): FundamentalMetric {
  if (value === null || !Number.isFinite(value)) return missing("价格或流通股数缺失", formula);
  return { value: round(value), source: "calculated", periodsUsed: [source], confidence: "high", missingReason: null, formula };
}

function missing(reason: string, formula: string): FundamentalMetric {
  return { value: null, source: "unavailable", periodsUsed: [], confidence: "insufficient", missingReason: reason, formula };
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
