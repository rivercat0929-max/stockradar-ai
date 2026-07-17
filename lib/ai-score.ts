import { getCache, getStaleCache, setCache } from "@/lib/cache";
import { calculateGrowth } from "@/lib/fundamentals/growth";
import { calculateQuality } from "@/lib/fundamentals/quality";
import type { DataStatus, FundamentalMetric } from "@/lib/fundamentals/sec/types";
import { getSecFundamentals } from "@/lib/fundamentals/sec/company-facts";
import { getHistoricalPrices } from "@/lib/market-data/history";
import { getQuote, type MarketQuote, type Quote } from "@/lib/market-data";
import { calculateTechnicalIndicators } from "@/lib/technical/indicators";
import { calculateTechnicalRisk } from "@/lib/technical/risk";
import { calculateValuation } from "@/lib/valuation/calculate";

export type AiScoreDataSource = "真实数据" | "真实数据计算" | "缓存数据" | "数据可能过期" | "暂无可靠数据";
export type AiScoreDimensionKey = "trend" | "growth" | "valuation" | "quality" | "risk";
export type AssetType = "stock" | "etf" | "leveraged_etf" | "inverse_etf" | "reit" | "fund" | "index" | "unknown";
export type Confidence = "high" | "medium" | "low" | "insufficient";

export type AiScoreDimension = {
  key: AiScoreDimensionKey;
  label: string;
  name: string;
  score: number | null;
  weight: number;
  status: DataStatus;
  source: string;
  updatedAt: string | null;
  metricsUsed: string[];
  missingMetrics: string[];
  explanation: string;
  weightedScore: number;
};

export type AiScoreResult = {
  success: true;
  data: RealAnalysisData;
  ticker: string;
  price: number | null;
  pe: number | null;
  eps: number | null;
  marketCap: number | null;
  changesPercentage: number | null;
  score: number | null;
  rating: string;
  ratingLabel: string;
  dimensions: AiScoreDimension[];
  dimensionScores: Partial<Record<AiScoreDimensionKey, number | null>>;
  strengths: string[];
  risks: string[];
  investorProfile: string;
  aiSummary: string;
  dataSource: AiScoreDataSource;
  dataSourceDetails: string[];
  assetType: AssetType;
  scoreMode: "real_data" | "insufficient" | "etf_limited";
  stale?: boolean;
  marketQuote: MarketQuote;
  overallScore: number | null;
  dataCoverage: number;
  confidence: Confidence;
  fundamentals: unknown;
  valuation: Record<string, FundamentalMetric>;
  technical: unknown;
  risk: unknown;
  warnings: string[];
};

export type RealAnalysisData = {
  symbol: string;
  assetType: AssetType;
  overallScore: number | null;
  dataCoverage: number;
  confidence: Confidence;
  dimensions: AiScoreDimension[];
  fundamentals: unknown;
  valuation: Record<string, FundamentalMetric>;
  technical: unknown;
  risk: unknown;
  warnings: string[];
};

export type AiScoreSummary = Pick<AiScoreResult, "ticker" | "score" | "rating" | "ratingLabel" | "price" | "changesPercentage" | "assetType" | "scoreMode" | "stale" | "dataSource" | "marketQuote">;

const scoreCacheTtlMs = 10 * 60 * 1000;
const weights: Record<AiScoreDimensionKey, number> = { trend: 0.2, growth: 0.25, valuation: 0.2, quality: 0.2, risk: 0.15 };

export async function getAiScore(ticker: string): Promise<AiScoreResult> {
  const symbol = ticker.trim().toUpperCase();
  const cacheKey = `ai-score:real-data:v2:${symbol}`;
  const cached = getCache<AiScoreResult>(cacheKey);
  if (cached) return cached;
  const stale = getStaleCache<AiScoreResult>(cacheKey);

  try {
    const [quote, history] = await Promise.all([getQuote(symbol), getHistoricalPrices(symbol)]);
    const assetType = detectAssetType(symbol, quote);
    const fundamentals = usesCompanyFundamentals(assetType) ? await getSecFundamentals(symbol) : emptyFundamentals(symbol, assetType);
    const result = buildRealDataScore(symbol, quote, fundamentals, history, assetType);
    if (!result.stale) setCache(cacheKey, result, scoreCacheTtlMs);
    return result;
  } catch (error) {
    if (stale) return { ...stale, stale: true, dataSource: "数据可能过期" };
    throw error;
  }
}

export function getCachedAiScore(ticker: string): AiScoreResult | null {
  return getCache<AiScoreResult>(`ai-score:real-data:v2:${ticker.trim().toUpperCase()}`) ?? null;
}

export function toAiScoreSummary(result: AiScoreResult): AiScoreSummary {
  return {
    ticker: result.ticker,
    score: result.score,
    rating: result.rating,
    ratingLabel: result.ratingLabel,
    price: result.price,
    changesPercentage: result.changesPercentage,
    assetType: result.assetType,
    scoreMode: result.scoreMode,
    stale: result.stale,
    dataSource: result.dataSource,
    marketQuote: result.marketQuote
  };
}

function buildRealDataScore(symbol: string, quote: Quote, fundamentals: Awaited<ReturnType<typeof getSecFundamentals>>, history: Awaited<ReturnType<typeof getHistoricalPrices>>, assetType: AssetType): AiScoreResult {
  const technical = history.ok ? calculateTechnicalIndicators(history.bars) : null;
  const growth = calculateGrowth(fundamentals.quarterly, fundamentals.annual);
  const quality = calculateQuality(fundamentals.quarterly, fundamentals.annual);
  const latest = fundamentals.quarterly[0] ?? fundamentals.annual[0] ?? null;
  const shares = latest?.sharesOutstanding ?? null;
  const valuation = calculateValuation({
    price: quote.price,
    sharesOutstanding: shares,
    ttmRevenue: growth.ttmRevenue,
    ttmNetIncome: growth.ttmNetIncome,
    ttmFreeCashFlow: growth.ttmFreeCashFlow,
    latestPeriod: latest,
    priceSource: `${quote.source} ${quote.updatedAt ?? quote.fetchedAt}`
  });
  const dimensions = isFundLike(assetType)
    ? buildEtfDimensions(technical, quote, history, assetType)
    : buildStockDimensions({ technical, growth, quality, valuation, quote, fundamentalsStatus: fundamentals.status, historyStatus: history.source });
  const scoring = calculateOverallScore(dimensions);
  const warnings = [
    ...fundamentals.warnings,
    ...history.warnings,
    "暂未接入可靠情绪数据源，不参与正式评分",
    ...getAssetWarnings(assetType)
  ].filter(Boolean);
  const rating = scoring.overallScore === null ? "Insufficient" : getRating(scoring.overallScore);
  const ratingLabel = scoring.overallScore === null ? "数据不足，暂不生成综合评分" : getRatingLabel(rating);
  const marketQuote = toMarketQuote(quote);
  const resultData: RealAnalysisData = {
    symbol,
    assetType,
    overallScore: scoring.overallScore,
    dataCoverage: scoring.dataCoverage,
    confidence: scoring.confidence,
    dimensions,
    fundamentals,
    valuation,
    technical,
    risk: technical ? calculateTechnicalRisk(technical, quote.marketCap) : null,
    warnings
  };

  return {
    success: true,
    data: resultData,
    ticker: symbol,
    price: quote.price,
    pe: valuation.pe.value,
    eps: latest?.epsDiluted ?? null,
    marketCap: valuation.marketCap.value ?? quote.marketCap,
    changesPercentage: quote.changePercent,
    score: scoring.overallScore,
    overallScore: scoring.overallScore,
    dataCoverage: scoring.dataCoverage,
    confidence: scoring.confidence,
    rating,
    ratingLabel,
    dimensions,
    dimensionScores: Object.fromEntries(dimensions.map((item) => [item.key, item.score])),
    strengths: buildStrengths(dimensions),
    risks: buildRisks(dimensions, warnings),
    investorProfile: scoring.confidence === "insufficient" ? "数据覆盖率不足，暂不适合作为买卖依据。" : "适合用于个人投资研究，请结合仓位和风险计划判断。",
    aiSummary: buildSummaryText(symbol, scoring, dimensions, assetType),
    dataSource: getOverallDataSource(dimensions),
    dataSourceDetails: buildDataSourceDetails(quote, fundamentals, history),
    assetType,
    scoreMode: scoring.confidence === "insufficient" ? "insufficient" : isFundLike(assetType) ? "etf_limited" : "real_data",
    stale: quote.isStale || quote.source === "stale-cache" || history.source === "stale-cache" || fundamentals.status === "stale-cache",
    marketQuote,
    fundamentals,
    valuation,
    technical,
    risk: resultData.risk,
    warnings
  };
}

function buildStockDimensions(input: {
  technical: ReturnType<typeof calculateTechnicalIndicators> | null;
  growth: ReturnType<typeof calculateGrowth>;
  quality: ReturnType<typeof calculateQuality>;
  valuation: Record<string, FundamentalMetric>;
  quote: Quote;
  fundamentalsStatus: DataStatus;
  historyStatus: string;
}): AiScoreDimension[] {
  return [
    trendDimension(input.technical, input.historyStatus),
    growthDimension(input.growth, input.fundamentalsStatus),
    valuationDimension(input.valuation),
    qualityDimension(input.quality, input.fundamentalsStatus),
    riskDimension(input.technical, input.quote)
  ];
}

function buildEtfDimensions(technical: ReturnType<typeof calculateTechnicalIndicators> | null, quote: Quote, history: Awaited<ReturnType<typeof getHistoricalPrices>>, assetType: AssetType): AiScoreDimension[] {
  return [
    trendDimension(technical, history.source),
    liquidityDimension(technical),
    unavailableDimension("valuation", "基金估值", "暂未接入可靠基金估值数据"),
    unavailableDimension("quality", assetType === "leveraged_etf" || assetType === "inverse_etf" ? "杠杆结构风险" : "费用效率/持仓集中度", assetType === "leveraged_etf" || assetType === "inverse_etf" ? "暂未接入真实杠杆ETF费用、跟踪误差和持仓集中度数据" : "暂未接入真实ETF费用率和持仓集中度数据"),
    riskDimension(technical, quote)
  ];
}

function liquidityDimension(technical: ReturnType<typeof calculateTechnicalIndicators> | null): AiScoreDimension {
  if (!technical) return unavailableDimension("growth", "流动性", "历史成交量不足");
  const item = scoreLiquidity(technical.averageVolume20, "20日平均成交量");
  if (!item) return unavailableDimension("growth", "流动性", "平均成交量不可用");
  return dimension("growth", "流动性", item.score, "calculated", "FMP/Yahoo historical prices", [item.name], ["费用率", "持仓集中度"], "由真实历史成交量计算，ETF不使用单公司营收/EPS成长模型。");
}

function trendDimension(technical: ReturnType<typeof calculateTechnicalIndicators> | null, source: string): AiScoreDimension {
  if (!technical) return unavailableDimension("trend", "趋势", "历史K线不足");
  const metrics = [
    scoreAbove(technical.currentClose, technical.ma20, "价格高于20日均线"),
    scoreAbove(technical.currentClose, technical.ma50, "价格高于50日均线"),
    scoreAbove(technical.currentClose, technical.ma200, "价格高于200日均线"),
    scoreRsi(technical.rsi14),
    scoreReturn(technical.return20),
    scoreReturn(technical.return60),
    scoreReturn(technical.return200),
    scoreHighDistance(technical.distanceFrom52WeekHigh)
  ].filter((item): item is { score: number; name: string } => item !== null);
  if (metrics.length < 4) return unavailableDimension("trend", "趋势", "趋势K线指标不足");
  return dimension("trend", "趋势", average(metrics.map((item) => item.score)), source === "stale-cache" ? "stale-cache" : "calculated", "FMP/Yahoo historical prices", metrics.map((item) => item.name), ["情绪数据"], "由均线、RSI、收益率和52周位置计算。");
}

function growthDimension(growth: ReturnType<typeof calculateGrowth>, status: DataStatus): AiScoreDimension {
  const items = [
    scoreGrowthMetric(growth.revenueYoY, "营收同比"),
    scoreGrowthMetric(growth.epsYoY, "EPS同比"),
    scoreGrowthMetric(growth.netIncomeYoY, "净利润同比"),
    scoreGrowthMetric(growth.freeCashFlowYoY, "自由现金流同比"),
    scoreGrowthMetric(growth.revenueCagr3y, "3年收入CAGR"),
    scoreGrowthMetric(growth.epsCagr3y, "3年EPS CAGR")
  ].filter((item): item is { score: number; name: string } => item !== null);
  if (items.length < 2) return unavailableDimension("growth", "成长", "成长数据不足");
  return dimension("growth", "成长", average(items.map((item) => item.score)), status === "stale-cache" ? "stale-cache" : "calculated", "SEC Company Facts", items.map((item) => item.name), [], "由SEC真实财务数据计算同比和CAGR。");
}

function valuationDimension(valuation: Record<string, FundamentalMetric>): AiScoreDimension {
  const items = [
    scoreValuationMetric(valuation.pe, "PE"),
    scoreValuationMetric(valuation.ps, "PS"),
    scoreValuationMetric(valuation.pfcf, "P/FCF"),
    scoreValuationMetric(valuation.pb, "PB")
  ].filter((item): item is { score: number; name: string } => item !== null);
  if (items.length < 2) return unavailableDimension("valuation", "估值", "暂无可靠估值数据");
  return dimension("valuation", "估值", average(items.map((item) => item.score)), "calculated", "Market quote + SEC TTM fundamentals", items.map((item) => item.name), [], "由当前价格、流通股数和SEC TTM财务数据计算。");
}

function qualityDimension(quality: ReturnType<typeof calculateQuality>, status: DataStatus): AiScoreDimension {
  const items = [
    scoreMargin(quality.freeCashFlowMargin, "自由现金流率"),
    scoreRatioCentered(quality.operatingCashFlowToNetIncome, "经营现金流/净利润"),
    scoreMargin(quality.grossMargin, "毛利率"),
    scoreMargin(quality.operatingMargin, "营业利润率"),
    scoreMargin(quality.roe, "ROE"),
    scoreDebt(quality.debtToAssets, "资产负债率"),
    scoreDilution(quality.shareDilution, "股本稀释趋势")
  ].filter((item): item is { score: number; name: string } => item !== null);
  if (items.length < 3) return unavailableDimension("quality", "盈利质量", "盈利质量数据不足");
  return dimension("quality", "盈利质量", average(items.map((item) => item.score)), status === "stale-cache" ? "stale-cache" : "calculated", "SEC Company Facts", items.map((item) => item.name), [], "由现金流、利润率、ROE、杠杆和股本变化计算。");
}

function riskDimension(technical: ReturnType<typeof calculateTechnicalIndicators> | null, quote: Quote): AiScoreDimension {
  if (!technical) return unavailableDimension("risk", "风险", "风险K线指标不足");
  const items = [
    scoreVolatility(technical.volatility20, "20日波动率"),
    scoreVolatility(technical.volatility60, "60日波动率"),
    scoreDrawdown(technical.maxDrawdown, "最大回撤"),
    scoreMarketCap(quote.marketCap, "市值"),
    scoreLiquidity(technical.averageVolume20, "流动性")
  ].filter((item): item is { score: number; name: string } => item !== null);
  if (items.length < 3) return unavailableDimension("risk", "风险", "风险数据不足");
  return dimension("risk", "风险", average(items.map((item) => item.score)), "calculated", "Historical prices + market quote", items.map((item) => item.name), ["Beta", "用户持仓集中度"], "高分代表风险控制较好，低分代表风险较高。");
}

function dimension(key: AiScoreDimensionKey, label: string, score: number, status: DataStatus, source: string, metricsUsed: string[], missingMetrics: string[], explanation: string): AiScoreDimension {
  const rounded = Math.round(clamp(score, 0, 100));
  return { key, label, name: label, score: rounded, weight: weights[key], status, source, updatedAt: new Date().toISOString(), metricsUsed, missingMetrics, explanation, weightedScore: rounded * weights[key] };
}

function unavailableDimension(key: AiScoreDimensionKey, label: string, reason: string): AiScoreDimension {
  return { key, label, name: label, score: null, weight: weights[key], status: "unavailable", source: "暂无可靠数据", updatedAt: null, metricsUsed: [], missingMetrics: [reason], explanation: reason, weightedScore: 0 };
}

function calculateOverallScore(dimensions: AiScoreDimension[]): { overallScore: number | null; dataCoverage: number; confidence: Confidence } {
  const valid = dimensions.filter((item) => item.score !== null && (item.status === "real" || item.status === "calculated" || item.status === "cache" || item.status === "stale-cache"));
  const validWeight = valid.reduce((sum, item) => sum + item.weight, 0);
  const dataCoverage = Math.round(validWeight * 100) / 100;
  const confidence = dataCoverage >= 0.85 ? "high" : dataCoverage >= 0.65 ? "medium" : dataCoverage >= 0.45 ? "low" : "insufficient";
  const weighted = validWeight > 0 ? Math.round(valid.reduce((sum, item) => sum + (item.score ?? 0) * item.weight, 0) / validWeight) : null;
  return { overallScore: dataCoverage < 0.45 ? null : weighted, dataCoverage, confidence };
}

function detectAssetType(symbol: string, quote: Quote): AssetType {
  const leveragedEtfs: Record<string, string> = { TSLL: "TSLA 2x", TQQQ: "NASDAQ-100 3x", SOXL: "Semiconductors 3x" };
  const inverseEtfs: Record<string, string> = { SQQQ: "NASDAQ-100 -3x", SOXS: "Semiconductors -3x" };
  const etfs = new Set(["SPY", "QQQ", "VOO", "VTI", "IWM", "DIA"]);
  const indexes = new Set(["SPX", "SPY500", "NDX", "DJI", "IXIC"]);
  if (symbol in leveragedEtfs) return "leveraged_etf";
  if (symbol in inverseEtfs) return "inverse_etf";
  if (indexes.has(symbol)) return "index";
  const name = (quote.name ?? "").toLowerCase();
  if (name.includes("reit")) return "reit";
  if (etfs.has(symbol) || name.includes("etf") || name.includes("exchange traded") || name.includes("fund") || name.includes("trust")) return "etf";
  return "stock";
}

function usesCompanyFundamentals(assetType: AssetType) {
  return assetType === "stock" || assetType === "reit";
}

function isFundLike(assetType: AssetType) {
  return assetType === "etf" || assetType === "leveraged_etf" || assetType === "inverse_etf" || assetType === "fund" || assetType === "index";
}

function emptyFundamentals(symbol: string, assetType: AssetType): Awaited<ReturnType<typeof getSecFundamentals>> {
  return { symbol, cik: null, companyName: null, status: "unavailable", source: "SEC Company Facts", updatedAt: null, annual: [], quarterly: [], warnings: isFundLike(assetType) ? [] : ["暂未获得可靠公司财务数据"] };
}

function getAssetWarnings(assetType: AssetType) {
  if (assetType === "leveraged_etf" || assetType === "inverse_etf") return ["该资产为每日重置杠杆ETF，长期表现可能明显偏离标的累计涨跌。", "杠杆ETF存在每日重置风险和波动损耗风险，通常不适合长期持有。"];
  if (isFundLike(assetType)) return ["ETF/基金不使用单公司营收、EPS、净利润等SEC Company Facts。"];
  return [];
}

function scoreAbove(current: number | null, ma: number | null, name: string) {
  if (current === null || ma === null || ma === 0) return null;
  return { name, score: current >= ma ? 75 : 40 };
}

function scoreRsi(value: number | null) {
  if (value === null) return null;
  return { name: "RSI14", score: value < 30 ? 45 : value <= 60 ? 78 : value <= 75 ? 65 : 40 };
}

function scoreReturn(value: number | null) {
  if (value === null) return null;
  return { name: "区间收益率", score: value > 20 ? 85 : value > 5 ? 72 : value > -5 ? 55 : 35 };
}

function scoreHighDistance(value: number | null) {
  if (value === null) return null;
  return { name: "距52周高点", score: value > -10 ? 75 : value > -25 ? 58 : 38 };
}

function scoreGrowthMetric(metric: FundamentalMetric, name: string) {
  if (metric.value === null) return null;
  return { name, score: metric.value > 25 ? 90 : metric.value > 10 ? 75 : metric.value > 0 ? 58 : 35 };
}

function scoreValuationMetric(metric: FundamentalMetric, name: string) {
  if (metric.value === null) return null;
  const value = metric.value;
  return { name, score: value <= 0 ? 25 : value < 15 ? 88 : value < 30 ? 75 : value < 60 ? 55 : 35 };
}

function scoreMargin(metric: FundamentalMetric, name: string) {
  if (metric.value === null) return null;
  return { name, score: metric.value > 30 ? 90 : metric.value > 15 ? 75 : metric.value > 5 ? 58 : 35 };
}

function scoreRatioCentered(metric: FundamentalMetric, name: string) {
  if (metric.value === null) return null;
  return { name, score: metric.value >= 100 ? 85 : metric.value >= 60 ? 65 : 35 };
}

function scoreDebt(metric: FundamentalMetric, name: string) {
  if (metric.value === null) return null;
  return { name, score: metric.value < 40 ? 85 : metric.value < 65 ? 65 : 35 };
}

function scoreDilution(metric: FundamentalMetric, name: string) {
  if (metric.value === null) return null;
  return { name, score: metric.value <= 0 ? 85 : metric.value < 5 ? 65 : 35 };
}

function scoreVolatility(value: number | null, name: string) {
  if (value === null) return null;
  return { name, score: value < 25 ? 85 : value < 45 ? 65 : 35 };
}

function scoreDrawdown(value: number | null, name: string) {
  if (value === null) return null;
  return { name, score: value > -15 ? 85 : value > -35 ? 60 : 30 };
}

function scoreMarketCap(value: number | null, name: string) {
  if (value === null) return null;
  return { name, score: value > 200_000_000_000 ? 85 : value > 20_000_000_000 ? 65 : 40 };
}

function scoreLiquidity(value: number | null, name: string) {
  if (value === null) return null;
  return { name, score: value > 5_000_000 ? 85 : value > 500_000 ? 65 : 35 };
}

function buildStrengths(dimensions: AiScoreDimension[]) {
  return dimensions.filter((item) => (item.score ?? 0) >= 70).map((item) => `${item.label}维度有真实数据支撑：${item.metricsUsed.join("、") || item.explanation}`).slice(0, 5);
}

function buildRisks(dimensions: AiScoreDimension[], warnings: string[]) {
  return [...dimensions.filter((item) => item.score === null || (item.score ?? 100) < 50).map((item) => `${item.label}：${item.explanation}`), ...warnings].slice(0, 6);
}

function buildSummaryText(symbol: string, scoring: ReturnType<typeof calculateOverallScore>, dimensions: AiScoreDimension[], assetType: AssetType) {
  if (scoring.overallScore === null) return `${symbol} 当前数据覆盖率 ${(scoring.dataCoverage * 100).toFixed(0)}%，低于生成综合评分的最低要求。`;
  const best = [...dimensions].filter((item) => item.score !== null).sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
  return `${symbol} 基于真实行情${isFundLike(assetType) ? "和历史K线" : "、历史K线和SEC财务数据"}的综合评分为 ${scoring.overallScore}/100，覆盖率 ${(scoring.dataCoverage * 100).toFixed(0)}%。${isFundLike(assetType) ? "该资产按ETF/基金有限模型处理。" : ""} 当前较强维度：${best?.label ?? "暂无"}。`;
}

function getOverallDataSource(dimensions: AiScoreDimension[]): AiScoreDataSource {
  if (dimensions.every((item) => item.status === "unavailable")) return "暂无可靠数据";
  if (dimensions.some((item) => item.status === "stale-cache")) return "数据可能过期";
  if (dimensions.some((item) => item.status === "cache")) return "缓存数据";
  return "真实数据计算";
}

function buildDataSourceDetails(quote: Quote, fundamentals: Awaited<ReturnType<typeof getSecFundamentals>>, history: Awaited<ReturnType<typeof getHistoricalPrices>>) {
  const hasSec = fundamentals.cik !== null || fundamentals.annual.length > 0 || fundamentals.quarterly.length > 0;
  return [
    `行情来源：${quote.source}，更新于 ${quote.updatedAt ?? quote.fetchedAt}`,
    hasSec ? `SEC财务来源：${fundamentals.status}，CIK ${fundamentals.cik}` : "SEC财务来源：不适用或暂未获得可靠公司财务数据",
    `历史K线来源：${history.source}，更新于 ${history.updatedAt ?? "暂无"}`,
    "Forward PE：暂无可靠分析师一致预期，不显示。",
    "情绪评分：暂未接入可靠情绪数据源，不参与正式评分。"
  ];
}

function getRating(score: number) {
  if (score >= 85) return "Strong Buy";
  if (score >= 75) return "Buy";
  if (score >= 60) return "Hold";
  if (score >= 45) return "Watch";
  return "Avoid";
}

function getRatingLabel(rating: string) {
  if (rating === "Strong Buy") return "强烈买入观察";
  if (rating === "Buy") return "买入观察";
  if (rating === "Hold") return "持有观察";
  if (rating === "Watch") return "谨慎观察";
  return "回避";
}

function toMarketQuote(quote: Quote): MarketQuote {
  return { symbol: quote.symbol, name: quote.name, price: quote.price, change: quote.change, changePercent: quote.changePercent, previousClose: quote.previousClose, open: quote.open, dayHigh: quote.dayHigh, dayLow: quote.dayLow, volume: quote.volume, marketCap: quote.marketCap, currency: quote.currency, exchange: quote.exchange, source: quote.source, originalSource: quote.originalSource, updatedAt: quote.updatedAt, fetchedAt: quote.fetchedAt, isStale: quote.isStale, isMarketOpen: quote.isMarketOpen, error: quote.error };
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
