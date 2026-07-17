import { getAiScore, type AiScoreResult, type Confidence } from "@/lib/ai-score";
import { getMarketEvents } from "@/lib/events";
import type { MarketEvent } from "@/lib/events/types";
import { getQuote, type MarketQuote } from "@/lib/market-data";
import { getHoldings } from "@/lib/repositories/holdings";
import type { Holding } from "@/lib/types";
import { getTradePlan, getTradePlans, type TradePlan } from "@/lib/trade-plans";

export type StockDecisionStatus =
  | "buy_in_batches"
  | "wait_for_pullback"
  | "hold"
  | "consider_reduce"
  | "high_risk"
  | "trigger_risk_control"
  | "plan_not_set"
  | "insufficient_data";

export type ResearchJudgment = "positive" | "neutral_positive" | "neutral" | "cautious" | "high_risk" | "insufficient_data";

export interface StockDecision {
  symbol: string;
  status: StockDecisionStatus;
  actionStatus: StockDecisionStatus;
  researchJudgment: ResearchJudgment;
  headline: string;
  summary: string;
  currentPrice: number | null;
  averageCost: number | null;
  returnPercent: number | null;
  positionWeight: number | null;
  positionWeightCoverage: number;
  supportingReasons: string[];
  riskReasons: string[];
  plan: {
    buyZoneLow: number | null;
    buyZoneHigh: number | null;
    addPrice1: number | null;
    addPrice2: number | null;
    riskControlPrice: number | null;
    targetPrice1: number | null;
    targetPrice2: number | null;
    maxPositionWeight: number | null;
  };
  thesis: string | null;
  invalidationConditions: string[];
  dataCoverage: number;
  confidence: Confidence;
  dataUpdatedAt: string | null;
  warnings: string[];
  planCompleteness: { completed: number; total: number };
  systemReference: SystemReference;
  events: DecisionEvent[];
  assetType: string;
  quote: MarketQuote | null;
}

export type SystemReference = {
  buyZoneLow: number | null;
  buyZoneHigh: number | null;
  supportPrice: number | null;
  resistancePrice: number | null;
  riskControlPrice: number | null;
  targetPrice1: number | null;
  targetPrice2: number | null;
  notes: string[];
};

export type DecisionEvent = {
  type: string;
  title: string;
  startAt: string;
  importance: string;
  dateStatus: string;
  sourceName: string;
};

type DecisionContext = {
  symbol: string;
  score: AiScoreResult | null;
  quote: MarketQuote | null;
  holding: Holding | null;
  totalMarketValue: number;
  positionWeightCoverage: number;
  plan: TradePlan | null;
  events: MarketEvent[];
};

export async function getStockDecision(symbol: string): Promise<StockDecision> {
  const normalized = symbol.trim().toUpperCase();
  const [holdings, plans] = await Promise.all([safeHoldings(), safePlans()]);
  const holding = holdings.find((item) => item.ticker.trim().toUpperCase() === normalized) ?? null;
  const plan = plans.find((item) => item.symbol === normalized) ?? await getTradePlan(normalized).catch(() => null);

  const [score, quote] = await Promise.all([
    getAiScore(normalized).catch(() => null),
    getQuote(normalized).catch(() => null)
  ]);
  const portfolio = await getPortfolioContext(holdings, normalized, toDecisionQuote(score, quote));
  const events = await getDecisionEvents(normalized);
  return buildStockDecision({ symbol: normalized, score, quote: toDecisionQuote(score, quote), holding, totalMarketValue: portfolio.totalMarketValue, positionWeightCoverage: portfolio.coverage, plan, events });
}

export async function getStockDecisions(symbols: string[]): Promise<{ results: StockDecision[]; errors: Array<{ symbol: string; error: string }> }> {
  const unique = Array.from(new Set(symbols.map((item) => item.trim().toUpperCase()).filter(Boolean)));
  const settled = await Promise.allSettled(unique.map((symbol) => getStockDecision(symbol)));
  return {
    results: settled.flatMap((item) => item.status === "fulfilled" ? [item.value] : []),
    errors: settled.flatMap((item, index) => item.status === "rejected" ? [{ symbol: unique[index], error: item.reason instanceof Error ? item.reason.message : "决策暂不可用" }] : [])
  };
}

export function buildStockDecision(context: DecisionContext): StockDecision {
  const { symbol, score, quote, holding, totalMarketValue, positionWeightCoverage, plan, events } = context;
  const currentPrice = finite(quote?.price) ? quote.price : finite(score?.price) ? score.price : null;
  const marketValue = holding && currentPrice !== null ? holding.shares * currentPrice : null;
  const averageCost = holding?.averageCost ?? null;
  const returnPercent = holding && currentPrice !== null && holding.averageCost > 0 ? ((currentPrice - holding.averageCost) / holding.averageCost) * 100 : null;
  const positionWeight = marketValue !== null && totalMarketValue > 0 ? (marketValue / totalMarketValue) * 100 : holding?.allocation ?? null;
  const dataCoverage = score?.dataCoverage ?? 0;
  const confidence = score?.confidence ?? "insufficient";
  const dimensions = new Map((score?.dimensions ?? []).map((item) => [item.key, item]));
  const systemReference = buildSystemReference(score, currentPrice, plan);
  const dataUpdatedAt = quote?.updatedAt ?? quote?.fetchedAt ?? score?.marketQuote?.updatedAt ?? score?.marketQuote?.fetchedAt ?? null;
  const baseWarnings = [...(score?.warnings ?? [])];
  if (quote?.source === "stale-cache" || quote?.isStale) baseWarnings.push("行情使用过期缓存。");
  if (quote?.source === "unavailable") baseWarnings.push("当前价格不可用。");
  if (events.some((event) => event.type === "earnings")) baseWarnings.push("未来7天存在财报事件，请控制仓位波动。");

  const riskReasons = buildRiskReasons({ currentPrice, positionWeight, plan, dimensions, quote, dataCoverage, confidence, score });
  const supportingReasons = buildSupportingReasons({ currentPrice, positionWeight, plan, dimensions, score, holding });
  const researchJudgment = decideResearchJudgment({ score, dimensions, dataCoverage, confidence, quote });
  const planCompleteness = getPlanCompleteness(plan);
  const actionStatus = decideActionStatus({ currentPrice, positionWeight, plan, dimensions, dataCoverage, confidence, quote, score, riskReasons, researchJudgment, planCompleteness });
  const headline = statusLabel(actionStatus);
  const summary = buildSummary(actionStatus, researchJudgment, supportingReasons, riskReasons, plan, holding);

  return {
    symbol,
    status: actionStatus,
    actionStatus,
    researchJudgment,
    headline,
    summary,
    currentPrice,
    averageCost,
    returnPercent,
    positionWeight,
    positionWeightCoverage,
    supportingReasons: supportingReasons.slice(0, 3),
    riskReasons: riskReasons.slice(0, 3),
    plan: {
      buyZoneLow: plan?.buyZoneLow ?? null,
      buyZoneHigh: plan?.buyZoneHigh ?? null,
      addPrice1: plan?.addPrice1 ?? null,
      addPrice2: plan?.addPrice2 ?? null,
      riskControlPrice: plan?.riskControlPrice ?? null,
      targetPrice1: plan?.targetPrice1 ?? null,
      targetPrice2: plan?.targetPrice2 ?? null,
      maxPositionWeight: plan?.maxPositionWeight ?? null
    },
    thesis: plan?.thesis ?? null,
    invalidationConditions: plan?.invalidationConditions ?? [],
    dataCoverage,
    confidence,
    dataUpdatedAt,
    warnings: Array.from(new Set(baseWarnings)).slice(0, 6),
    planCompleteness,
    systemReference,
    events: events.map(toDecisionEvent),
    assetType: score?.assetType ?? "unknown",
    quote
  };
}

function decideResearchJudgment(input: {
  score: AiScoreResult | null;
  dimensions: Map<string, NonNullable<AiScoreResult["dimensions"]>[number]>;
  dataCoverage: number;
  confidence: Confidence;
  quote: MarketQuote | null;
}): ResearchJudgment {
  const { score, dimensions, dataCoverage, confidence, quote } = input;
  if (!score || dataCoverage < 0.45 || confidence === "insufficient" || quote?.source === "unavailable") return "insufficient_data";
  const risk = scoreOf(dimensions, "risk");
  const trend = scoreOf(dimensions, "trend");
  const valuation = scoreOf(dimensions, "valuation");
  const growth = scoreOf(dimensions, "growth");
  const quality = scoreOf(dimensions, "quality");
  if (risk !== null && risk < 45) return "high_risk";
  if ((trend ?? 0) >= 60 && ((growth ?? quality ?? 0) >= 55 || score.assetType !== "stock") && (valuation === null || valuation >= 45)) return "neutral_positive";
  if ((valuation !== null && valuation < 45) || (trend !== null && trend < 45)) return "cautious";
  if ((score.overallScore ?? 0) >= 70) return "positive";
  return "neutral";
}

function decideActionStatus(input: {
  currentPrice: number | null;
  positionWeight: number | null;
  plan: TradePlan | null;
  dimensions: Map<string, NonNullable<AiScoreResult["dimensions"]>[number]>;
  dataCoverage: number;
  confidence: Confidence;
  quote: MarketQuote | null;
  score: AiScoreResult | null;
  riskReasons: string[];
  researchJudgment: ResearchJudgment;
  planCompleteness: { completed: number; total: number };
}): StockDecisionStatus {
  const { currentPrice, positionWeight, plan, dimensions, dataCoverage, confidence, quote, score, riskReasons, planCompleteness } = input;
  if (dataCoverage < 0.45 || currentPrice === null || !score || score.assetType === "unknown" || confidence === "insufficient") return "insufficient_data";
  if (quote?.source === "unavailable" || quote?.source === "stale-cache" || quote?.isStale) return "insufficient_data";
  if (plan?.riskControlPrice !== null && plan?.riskControlPrice !== undefined && currentPrice <= plan.riskControlPrice) return "trigger_risk_control";
  if (riskReasons.length >= 2 || scoreOf(dimensions, "risk") !== null && scoreOf(dimensions, "risk")! < 45) return "high_risk";
  if (finite(plan?.maxPositionWeight) && finite(positionWeight) && positionWeight > plan!.maxPositionWeight! * 1.15) return "consider_reduce";
  if (finite(plan?.targetPrice2) && currentPrice >= plan!.targetPrice2!) return "consider_reduce";
  if (finite(plan?.targetPrice1) && currentPrice >= plan!.targetPrice1!) return "consider_reduce";
  if (!hasCompleteCorePlan(plan)) return "plan_not_set";
  if (isInBuyZone(currentPrice, plan) && qualityOk(dimensions) && growthOk(dimensions) && riskOk(dimensions) && belowMaxPosition(positionWeight, plan)) return "buy_in_batches";
  if ((plan?.buyZoneHigh && currentPrice > plan.buyZoneHigh && belowMaxPosition(positionWeight, plan)) || (input.researchJudgment === "neutral_positive" && scoreOf(dimensions, "valuation") !== null && scoreOf(dimensions, "valuation")! < 55)) return "wait_for_pullback";
  return "hold";
}

function buildSupportingReasons(input: { currentPrice: number | null; positionWeight: number | null; plan: TradePlan | null; dimensions: Map<string, NonNullable<AiScoreResult["dimensions"]>[number]>; score: AiScoreResult | null; holding: Holding | null }) {
  const reasons: string[] = [];
  const quality = scoreOf(input.dimensions, "quality");
  const growth = scoreOf(input.dimensions, "growth");
  const valuation = scoreOf(input.dimensions, "valuation");
  const trend = scoreOf(input.dimensions, "trend");
  const technical = (input.score?.technical ?? input.score?.data?.technical ?? null) as Record<string, number | null> | null;
  if (trend !== null && trend >= 55) reasons.push(buildTrendReason(technical, trend));
  if (quality !== null && quality >= 60) reasons.push(buildDimensionReason(input.score, "quality", `盈利质量维度 ${quality}/100，现金流、利润率或杠杆指标表现较好。`));
  if (growth !== null && growth >= 60) reasons.push(buildDimensionReason(input.score, "growth", `成长/流动性维度 ${growth}/100，相关真实指标表现合格。`));
  if (valuation !== null && valuation >= 55) reasons.push(buildDimensionReason(input.score, "valuation", `估值维度 ${valuation}/100，当前估值未显示明显过热。`));
  if (input.currentPrice !== null && isInBuyZone(input.currentPrice, input.plan)) reasons.push("当前价格进入我的计划买入区。");
  if (belowMaxPosition(input.positionWeight, input.plan)) reasons.push("当前仓位低于我的最大计划仓位。");
  if (!input.holding) reasons.push("当前未持有，可作为观察或分批计划候选。");
  return reasons.length ? reasons : ["没有足够支持理由生成买入或加仓结论。"];
}

function buildRiskReasons(input: { currentPrice: number | null; positionWeight: number | null; plan: TradePlan | null; dimensions: Map<string, NonNullable<AiScoreResult["dimensions"]>[number]>; quote: MarketQuote | null; dataCoverage: number; confidence: Confidence; score: AiScoreResult | null }) {
  const reasons: string[] = [];
  const risk = scoreOf(input.dimensions, "risk");
  const valuation = scoreOf(input.dimensions, "valuation");
  const growth = scoreOf(input.dimensions, "growth");
  if (input.dataCoverage < 0.45) reasons.push("数据覆盖率低于45%，暂不生成正式买卖结论。");
  if (input.currentPrice === null) reasons.push("当前价格不可用。");
  if (input.quote?.source === "stale-cache" || input.quote?.isStale) reasons.push("行情数据可能过期。");
  if (input.score?.assetType === "leveraged_etf" || input.score?.assetType === "inverse_etf") reasons.push("该资产为每日重置杠杆ETF，长期表现可能明显偏离标的累计涨跌。");
  if (risk !== null && risk < 45) reasons.push(`风险维度 ${risk}/100，波动率、最大回撤或流动性风险偏高。`);
  if (finite(input.plan?.riskControlPrice) && input.currentPrice !== null && input.currentPrice <= input.plan!.riskControlPrice!) reasons.push(`股价已跌破我的风险控制价 ${money(input.plan!.riskControlPrice!)}。`);
  if (finite(input.plan?.maxPositionWeight) && finite(input.positionWeight) && input.positionWeight > input.plan!.maxPositionWeight!) reasons.push(`当前仓位 ${percent(input.positionWeight)} 超过我的最大计划仓位 ${percent(input.plan!.maxPositionWeight!)}。`);
  if (finite(input.plan?.targetPrice1) && input.currentPrice !== null && input.currentPrice >= input.plan!.targetPrice1!) reasons.push(`股价已达到我的第一目标价 ${money(input.plan!.targetPrice1!)}。`);
  if (valuation !== null && valuation < 45 && growth !== null && growth < 55) reasons.push("估值维度偏弱，同时成长未能抵消估值压力。");
  if (input.confidence === "low") reasons.push("可信度偏低，需要谨慎使用结论。");
  return reasons;
}

function buildSystemReference(score: AiScoreResult | null, currentPrice: number | null, plan: TradePlan | null): SystemReference {
  const technical = (score?.technical ?? score?.data?.technical ?? null) as Record<string, number | null> | null;
  const ma20 = numberOrNull(technical?.ma20);
  const ma50 = numberOrNull(technical?.ma50);
  const ma200 = numberOrNull(technical?.ma200);
  const high52 = numberOrNull(technical?.high52Week);
  const low52 = numberOrNull(technical?.low52Week);
  const volatility = numberOrNull(technical?.volatility20);
  const support = maxNumber([ma50, ma200, low52]);
  const resistance = minAbove([ma20, ma50, high52], currentPrice);
  const notes = [
    ma20 ? `MA20 ${money(ma20)}` : null,
    ma50 ? `MA50 ${money(ma50)}` : null,
    ma200 ? `MA200 ${money(ma200)}` : null,
    low52 && high52 ? `52周区间 ${money(low52)} - ${money(high52)}` : null,
    volatility ? `20日波动率 ${percent(volatility)}` : null,
    ...getLeveragedEtfNotes(score?.ticker ?? "", score?.assetType)
  ].filter((item): item is string => Boolean(item));
  return {
    buyZoneLow: support !== null ? roundMoney(support * 0.98) : null,
    buyZoneHigh: support !== null ? roundMoney(support * 1.03) : null,
    supportPrice: support,
    resistancePrice: resistance,
    riskControlPrice: support !== null ? roundMoney(support * 0.93) : null,
    targetPrice1: resistance,
    targetPrice2: resistance !== null ? roundMoney(resistance * 1.08) : null,
    notes: [...notes, plan?.maxPositionWeight ? `参考仓位上限不覆盖我的计划：${percent(plan.maxPositionWeight)}` : null].filter((item): item is string => Boolean(item))
  };
}

function getLeveragedEtfNotes(symbol: string, assetType?: string) {
  const meta: Record<string, string> = {
    TSLL: "杠杆倍数 2x，跟踪标的 TSLA",
    TQQQ: "杠杆倍数 3x，跟踪标的 NASDAQ-100",
    SQQQ: "反向杠杆 -3x，跟踪标的 NASDAQ-100",
    SOXL: "杠杆倍数 3x，跟踪标的半导体指数",
    SOXS: "反向杠杆 -3x，跟踪标的半导体指数"
  };
  if (assetType !== "leveraged_etf" && assetType !== "inverse_etf") return [];
  return [meta[symbol] ?? "杠杆ETF", "每日重置风险", "波动损耗风险", "通常不适合长期持有"];
}

function buildSummary(status: StockDecisionStatus, researchJudgment: ResearchJudgment, supportingReasons: string[], riskReasons: string[], plan: TradePlan | null, holding: Holding | null) {
  if (status === "insufficient_data") return "数据不足，暂不生成买卖结论。";
  if (status === "plan_not_set") return `研究判断：${researchJudgmentLabel(researchJudgment)}。尚未设置完整买卖计划，因此不输出正式行动结论。`;
  if (status === "trigger_risk_control") return `${riskReasons[0] ?? "价格触发风险控制条件。"} 请优先复核原投资逻辑是否失效。`;
  if (status === "buy_in_batches") return `${supportingReasons[0]} 当前进入我的计划买入区，但仍需按仓位上限分批执行。`;
  if (status === "wait_for_pullback") return "公司或趋势仍有可观察价值，但当前价格高于我的计划买入区，因此等待回调，不建议追高。";
  if (status === "consider_reduce") return `${riskReasons[0] ?? "风险收益比已经变化。"} 建议检查是否按计划减仓。`;
  if (status === "high_risk") return `${riskReasons[0] ?? "风险因素偏高。"} 优先检查风险控制价、仓位和投资逻辑是否失效。`;
  return `${holding ? "当前持仓未触发加仓、减仓或风险控制条件。" : "当前未持有且未进入明确买入区。"} ${plan?.thesis ? "继续跟踪投资逻辑是否成立。" : "建议先补充投资逻辑和风险条件。"}`;
}

function toDecisionQuote(score: AiScoreResult | null, quote: Awaited<ReturnType<typeof getQuote>> | null): MarketQuote | null {
  return quote ?? score?.marketQuote ?? null;
}

async function safeHoldings() {
  try {
    return await getHoldings();
  } catch {
    return [];
  }
}

async function safePlans() {
  try {
    return await getTradePlans();
  } catch {
    return [];
  }
}

async function getDecisionEvents(symbol: string) {
  const from = new Date();
  const to = new Date(from);
  to.setDate(from.getDate() + 7);
  try {
    const result = await getMarketEvents({ from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10), symbols: [symbol] });
    return result.events;
  } catch {
    return [];
  }
}

function toDecisionEvent(event: MarketEvent): DecisionEvent {
  return { type: event.type, title: event.title, startAt: event.startAt, importance: event.importance, dateStatus: event.dateStatus, sourceName: event.sourceName };
}

function statusLabel(status: StockDecisionStatus) {
  return {
    buy_in_batches: "分批买入",
    wait_for_pullback: "等待回调",
    hold: "继续持有",
    consider_reduce: "考虑减仓",
    high_risk: "风险较高",
    trigger_risk_control: "触发风险控制",
    plan_not_set: "尚未设置计划",
    insufficient_data: "数据不足"
  }[status];
}

function researchJudgmentLabel(value: ResearchJudgment) {
  return {
    positive: "偏积极",
    neutral_positive: "中性偏积极",
    neutral: "中性",
    cautious: "谨慎",
    high_risk: "风险较高",
    insufficient_data: "数据不足"
  }[value];
}

async function getPortfolioContext(holdings: Holding[], symbol: string, symbolQuote: MarketQuote | null) {
  const quotes = await Promise.all(holdings.map(async (holding) => {
    const ticker = holding.ticker.trim().toUpperCase();
    const quote = ticker === symbol && symbolQuote ? symbolQuote : await getQuote(ticker).catch(() => null);
    return { holding, quote };
  }));
  const valid = quotes.filter((item) => finite(item.quote?.price));
  return {
    totalMarketValue: valid.reduce((sum, item) => sum + item.holding.shares * item.quote!.price!, 0),
    coverage: holdings.length ? valid.length / holdings.length : 0
  };
}

function getPlanCompleteness(plan: TradePlan | null) {
  const total = 7;
  const completed = [
    Boolean(finite(plan?.buyZoneLow) && finite(plan?.buyZoneHigh)),
    finite(plan?.addPrice1),
    finite(plan?.addPrice2),
    finite(plan?.riskControlPrice),
    finite(plan?.targetPrice1),
    finite(plan?.targetPrice2),
    finite(plan?.maxPositionWeight)
  ].filter(Boolean).length;
  return { completed, total };
}

function hasCompleteCorePlan(plan: TradePlan | null) {
  return Boolean(
    finite(plan?.buyZoneLow) &&
    finite(plan?.buyZoneHigh) &&
    finite(plan?.riskControlPrice) &&
    (finite(plan?.targetPrice1) || finite(plan?.targetPrice2)) &&
    finite(plan?.maxPositionWeight)
  );
}

function buildTrendReason(technical: Record<string, number | null> | null, score: number) {
  if (!technical) return `趋势维度 ${score}/100，历史K线指标表现可观察。`;
  const close = numberOrNull(technical.currentClose);
  const ma50 = numberOrNull(technical.ma50);
  const ma200 = numberOrNull(technical.ma200);
  const rsi = numberOrNull(technical.rsi14);
  if (close !== null && ma200 !== null && close > ma200) return `趋势维度 ${score}/100，当前价格位于MA200上方。`;
  if (close !== null && ma50 !== null && close < ma50) return `趋势维度 ${score}/100，但当前价格跌破MA50，需要观察趋势修复。`;
  if (rsi !== null && rsi > 70) return `趋势维度 ${score}/100，RSI ${rsi.toFixed(1)} 偏高，短期可能过热。`;
  return `趋势维度 ${score}/100，均线、RSI和52周位置未明显转弱。`;
}

function buildDimensionReason(score: AiScoreResult | null, key: string, fallback: string) {
  const dimension = score?.dimensions.find((item) => item.key === key);
  if (!dimension?.metricsUsed.length) return fallback;
  return `${dimension.label}维度 ${dimension.score}/100，使用指标：${dimension.metricsUsed.slice(0, 3).join("、")}。`;
}

function isInBuyZone(price: number, plan: TradePlan | null) {
  return finite(plan?.buyZoneLow) && finite(plan?.buyZoneHigh) && price >= plan!.buyZoneLow! && price <= plan!.buyZoneHigh!;
}

function qualityOk(dimensions: Map<string, NonNullable<AiScoreResult["dimensions"]>[number]>) {
  return (scoreOf(dimensions, "quality") ?? 0) >= 55;
}

function growthOk(dimensions: Map<string, NonNullable<AiScoreResult["dimensions"]>[number]>) {
  return (scoreOf(dimensions, "growth") ?? 0) >= 55;
}

function riskOk(dimensions: Map<string, NonNullable<AiScoreResult["dimensions"]>[number]>) {
  return (scoreOf(dimensions, "risk") ?? 0) >= 50;
}

function belowMaxPosition(positionWeight: number | null, plan: TradePlan | null) {
  if (!finite(plan?.maxPositionWeight)) return true;
  return !finite(positionWeight) || positionWeight < plan!.maxPositionWeight!;
}

function scoreOf(dimensions: Map<string, NonNullable<AiScoreResult["dimensions"]>[number]>, key: string) {
  const value = dimensions.get(key)?.score;
  return finite(value) ? value : null;
}

function minAbove(values: Array<number | null>, price: number | null) {
  const candidates = values.filter((value): value is number => finite(value) && (price === null || value >= price * 0.98));
  return candidates.length ? roundMoney(Math.min(...candidates)) : null;
}

function maxNumber(values: Array<number | null>) {
  const candidates = values.filter((value): value is number => finite(value));
  return candidates.length ? roundMoney(Math.max(...candidates)) : null;
}

function numberOrNull(value: unknown) {
  return finite(value) ? value : null;
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
}

function percent(value: number) {
  return `${value.toFixed(1)}%`;
}
