import { getCache, getStaleCache, setCache } from "@/lib/cache";
import { getQuote, type MarketQuote, type Quote } from "@/lib/market-data";

export type AiScoreDataSource = "真实数据" | "缓存数据" | "估算数据" | "示例数据";
export type AiScoreDimensionKey = "trend" | "growth" | "valuation" | "quality" | "sentiment" | "risk";
export type AiScoreMode = "full" | "market_only" | "estimated";

export type AiScoreBreakdownItem = {
  name: string;
  score: number;
  max: number;
  reason: string;
  source: AiScoreDataSource;
};

export type AiScoreDimension = {
  key: AiScoreDimensionKey;
  name: string;
  score: number;
  weight: number;
  weightedScore: number;
  source: AiScoreDataSource;
  reason: string;
};

export type AiScoreResult = {
  ticker: string;
  price: number | null;
  pe: number | null;
  eps: number | null;
  marketCap: number | null;
  changesPercentage: number | null;
  score: number;
  rating: string;
  ratingLabel: string;
  dimensions: AiScoreDimension[];
  dimensionScores: Record<AiScoreDimensionKey, number>;
  breakdown: AiScoreBreakdownItem[];
  strengths: string[];
  risks: string[];
  investorProfile: string;
  aiSummary: string;
  dataSource: AiScoreDataSource;
  dataSourceDetails: string[];
  assetType?: "ETF";
  scoreMode?: AiScoreMode;
  stale?: boolean;
  marketQuote: MarketQuote;
};

export type AiScoreSummary = Pick<
  AiScoreResult,
  "ticker" | "score" | "rating" | "ratingLabel" | "price" | "changesPercentage" | "assetType" | "scoreMode" | "stale" | "dataSource" | "marketQuote"
>;

const scoreCacheTtlMs = 10 * 60 * 1000;

export async function getAiScore(ticker: string, _apiKey?: string): Promise<AiScoreResult> {
  const normalizedTicker = ticker.trim().toUpperCase();
  const cacheKey = getAiScoreCacheKey(normalizedTicker);
  const cachedScore = getCache<AiScoreResult>(cacheKey);
  if (cachedScore) return cachedScore;

  const staleScore = getStaleCache<AiScoreResult>(cacheKey);

  try {
    const quote = await getQuote(normalizedTicker);
    const result = buildAiScoreFromQuote(quote);
    if (!result.stale) setCache(cacheKey, result, scoreCacheTtlMs);
    return result;
  } catch (error) {
    if (staleScore) return { ...staleScore, stale: true, dataSource: "缓存数据" };
    throw error;
  }
}

export function getCachedAiScore(ticker: string): AiScoreResult | null {
  const normalizedTicker = ticker.trim().toUpperCase();
  const cachedScore = getCache<AiScoreResult>(getAiScoreCacheKey(normalizedTicker));
  if (cachedScore) return cachedScore;

  const staleScore = getStaleCache<AiScoreResult>(getAiScoreCacheKey(normalizedTicker));
  return staleScore ? { ...staleScore, stale: true, dataSource: "缓存数据" } : null;
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

function buildAiScoreFromQuote(quote: Quote): AiScoreResult {
  const rawPrice = quote.price;
  const rawChangesPercentage = quote.changesPercentage;
  const price = numberOrZero(rawPrice);
  const changesPercentage = numberOrZero(rawChangesPercentage);
  const pe = nullableNumber(quote.pe);
  const eps = nullableNumber(quote.eps);
  const marketCap = nullableNumber(quote.marketCap);
  const isMarketOnly = pe === null && eps === null;
  const baseSource = getQuoteSource(quote);
  const dimensions = scoreDimensions({ quote, price, changesPercentage, pe, eps, marketCap, baseSource, isMarketOnly });
  const score = Math.round(dimensions.reduce((sum, item) => sum + item.weightedScore, 0));
  const rating = getRating(score);
  const ratingLabel = getRatingLabel(rating);
  const scoreMode: AiScoreMode = isMarketOnly ? "market_only" : dimensions.some((item) => item.source === "估算数据") ? "estimated" : "full";
  const result: AiScoreResult = {
    ticker: quote.ticker,
    price: rawPrice,
    pe,
    eps,
    marketCap,
    changesPercentage: rawChangesPercentage,
    score,
    rating,
    ratingLabel,
    dimensions,
    dimensionScores: Object.fromEntries(dimensions.map((item) => [item.key, item.score])) as Record<AiScoreDimensionKey, number>,
    breakdown: dimensions.map(toBreakdownItem),
    strengths: getStrengths({ score, dimensions, pe, eps, marketCap, changesPercentage, scoreMode }),
    risks: getRisks({ dimensions, pe, eps, marketCap, changesPercentage, scoreMode, quote }),
    investorProfile: getInvestorProfile({ score, changesPercentage, marketCap, scoreMode }),
    aiSummary: getAiSummary({ ticker: quote.ticker, score, ratingLabel, dimensions, changesPercentage, scoreMode, baseSource }),
    dataSource: getOverallSource(dimensions, baseSource),
    dataSourceDetails: getDataSourceDetails(quote, dimensions, isMarketOnly),
    assetType: isMarketOnly ? ("ETF" as const) : undefined,
    scoreMode,
    stale: quote.stale,
    marketQuote: toMarketQuote(quote)
  };

  return result;
}

function scoreDimensions({
  quote,
  price,
  changesPercentage,
  pe,
  eps,
  marketCap,
  baseSource,
  isMarketOnly
}: {
  quote: Quote;
  price: number;
  changesPercentage: number;
  pe: number | null;
  eps: number | null;
  marketCap: number | null;
  baseSource: AiScoreDataSource;
  isMarketOnly: boolean;
}) {
  const trend = scoreTrend({ quote, price, changesPercentage, baseSource });
  const growth = scoreGrowth({ changesPercentage, eps, marketCap, isMarketOnly });
  const valuation = scoreValuation({ pe, isMarketOnly, trendScore: trend.score });
  const quality = scoreQuality({ eps, marketCap, isMarketOnly });
  const sentiment = scoreSentiment({ quote, changesPercentage, baseSource });
  const risk = scoreRisk({ quote, changesPercentage, marketCap, baseSource });

  return [
    { key: "trend" as const, name: "趋势 Trend", weight: 20, ...trend },
    { key: "growth" as const, name: "成长 Growth", weight: 20, ...growth },
    { key: "valuation" as const, name: "估值 Valuation", weight: 15, ...valuation },
    { key: "quality" as const, name: "盈利 Quality", weight: 15, ...quality },
    { key: "sentiment" as const, name: "情绪 Sentiment", weight: 15, ...sentiment },
    { key: "risk" as const, name: "风险 Risk", weight: 15, ...risk }
  ].map((item) => ({
    ...item,
    score: clamp(Math.round(item.score), 0, 100),
    weightedScore: (clamp(Math.round(item.score), 0, 100) * item.weight) / 100
  }));
}

function scoreTrend({ quote, price, changesPercentage, baseSource }: { quote: Quote; price: number; changesPercentage: number; baseSource: AiScoreDataSource }) {
  const moveScore = changesPercentage > 3 ? 92 : changesPercentage >= 1 ? 78 : changesPercentage >= 0 ? 66 : changesPercentage >= -3 ? 48 : 28;
  const rangeScore = getRangePositionScore(price, quote.yearLow, quote.yearHigh);
  const score = rangeScore === null ? moveScore : moveScore * 0.65 + rangeScore * 0.35;

  return {
    score,
    source: rangeScore === null ? getEstimatedSource(baseSource) : baseSource,
    reason: rangeScore === null
      ? `涨跌幅为 ${formatPercent(changesPercentage)}，缺少52周区间时主要按短期趋势估算。`
      : `涨跌幅为 ${formatPercent(changesPercentage)}，并结合52周价格区间位置计算趋势。`
  };
}

function scoreGrowth({ changesPercentage, eps, marketCap, isMarketOnly }: { changesPercentage: number; eps: number | null; marketCap: number | null; isMarketOnly: boolean }) {
  if (eps !== null) {
    const epsBase = eps > 10 ? 88 : eps >= 3 ? 74 : eps > 0 ? 58 : 25;
    const sizeBoost = marketCap !== null && marketCap >= 100_000_000_000 ? 6 : 0;
    return {
      score: epsBase + sizeBoost + Math.max(-8, Math.min(8, changesPercentage)),
      source: "真实数据" as const,
      reason: `EPS 为 ${formatNumber(eps)}，结合市值规模和短期动量评估成长质量。`
    };
  }

  const estimate = 52 + Math.max(-12, Math.min(12, changesPercentage * 2)) + (marketCap !== null && marketCap >= 100_000_000_000 ? 6 : 0);
  return {
    score: isMarketOnly ? Math.min(68, estimate) : estimate,
    source: "估算数据" as const,
    reason: isMarketOnly ? "ETF/基金通常缺少 EPS，成长维度使用价格动量和规模进行保守估算。" : "缺少 EPS，成长维度使用价格动量和市值规模估算。"
  };
}

function scoreValuation({ pe, isMarketOnly, trendScore }: { pe: number | null; isMarketOnly: boolean; trendScore: number }) {
  if (pe !== null) {
    const score = pe <= 0 ? 35 : pe < 20 ? 88 : pe <= 35 ? 74 : pe <= 60 ? 58 : pe <= 100 ? 42 : 25;
    return {
      score,
      source: "真实数据" as const,
      reason: pe <= 0 ? "PE 小于等于0，估值可读性较弱，按保守规则计分。" : `PE 为 ${formatNumber(pe)}，按估值区间计分。`
    };
  }

  return {
    score: isMarketOnly ? Math.min(62, trendScore * 0.75) : 50,
    source: "估算数据" as const,
    reason: isMarketOnly ? "ETF/基金可能没有 PE，估值维度使用市场走势保守估算。" : "缺少 PE，估值维度按中性偏保守估算。"
  };
}

function scoreQuality({ eps, marketCap, isMarketOnly }: { eps: number | null; marketCap: number | null; isMarketOnly: boolean }) {
  if (eps !== null) {
    const epsScore = eps > 10 ? 92 : eps >= 3 ? 78 : eps > 0 ? 60 : 25;
    const capScore = marketCap === null ? 50 : marketCap > 1_000_000_000_000 ? 95 : marketCap >= 100_000_000_000 ? 82 : marketCap >= 10_000_000_000 ? 62 : 45;
    return {
      score: epsScore * 0.7 + capScore * 0.3,
      source: marketCap === null ? "估算数据" as const : "真实数据" as const,
      reason: `EPS 为 ${formatNumber(eps)}，并结合市值稳定性衡量盈利质量。`
    };
  }

  const estimate = marketCap === null ? 48 : marketCap >= 100_000_000_000 ? 62 : 52;
  return {
    score: isMarketOnly ? Math.min(60, estimate) : estimate,
    source: "估算数据" as const,
    reason: isMarketOnly ? "ETF/基金可能没有 EPS，盈利质量维度按基金类资产保守估算。" : "缺少 EPS，盈利质量维度按市值稳定性估算。"
  };
}

function scoreSentiment({ quote, changesPercentage, baseSource }: { quote: Quote; changesPercentage: number; baseSource: AiScoreDataSource }) {
  const moveScore = changesPercentage > 5 ? 92 : changesPercentage > 2 ? 80 : changesPercentage >= 0 ? 66 : changesPercentage >= -2 ? 46 : 30;
  const volumeScore = quote.volume ? clamp(55 + Math.log10(Math.max(quote.volume, 1)) * 4, 45, 85) : null;

  return {
    score: volumeScore === null ? moveScore : moveScore * 0.75 + volumeScore * 0.25,
    source: volumeScore === null ? getEstimatedSource(baseSource) : baseSource,
    reason: volumeScore === null
      ? `情绪维度主要参考今日涨跌幅 ${formatPercent(changesPercentage)}，成交量数据不足。`
      : `情绪维度结合今日涨跌幅 ${formatPercent(changesPercentage)} 和成交量。`
  };
}

function scoreRisk({ quote, changesPercentage, marketCap, baseSource }: { quote: Quote; changesPercentage: number; marketCap: number | null; baseSource: AiScoreDataSource }) {
  const absMove = Math.abs(changesPercentage);
  const volatilityScore = absMove <= 2 ? 88 : absMove <= 5 ? 72 : absMove <= 10 ? 48 : 25;
  const capScore = marketCap === null ? 52 : marketCap > 1_000_000_000_000 ? 92 : marketCap >= 100_000_000_000 ? 78 : marketCap >= 10_000_000_000 ? 58 : 40;
  const intradayRange = quote.dayHigh !== null && quote.dayLow !== null && quote.price ? ((quote.dayHigh - quote.dayLow) / quote.price) * 100 : null;
  const rangePenalty = intradayRange !== null && intradayRange > 5 ? 8 : 0;

  return {
    score: volatilityScore * 0.6 + capScore * 0.4 - rangePenalty,
    source: marketCap === null || intradayRange === null ? getEstimatedSource(baseSource) : baseSource,
    reason: `风险维度按波动幅度 ${formatPercent(absMove)}、市值规模和日内振幅综合计算。`
  };
}

function toBreakdownItem(dimension: AiScoreDimension): AiScoreBreakdownItem {
  return {
    name: dimension.name,
    score: Math.round(dimension.weightedScore),
    max: dimension.weight,
    reason: dimension.reason,
    source: dimension.source
  };
}

function getStrengths({
  score,
  dimensions,
  pe,
  eps,
  marketCap,
  changesPercentage,
  scoreMode
}: {
  score: number;
  dimensions: AiScoreDimension[];
  pe: number | null;
  eps: number | null;
  marketCap: number | null;
  changesPercentage: number;
  scoreMode: AiScoreMode;
}) {
  const strengths: string[] = [];
  const topDimensions = [...dimensions].sort((a, b) => b.score - a.score).slice(0, 2);
  topDimensions.forEach((dimension) => {
    if (dimension.score >= 70) strengths.push(`${dimension.name} 表现较好，当前维度得分 ${dimension.score}/100。`);
  });
  if (score >= 75) strengths.push("综合评分较高，六维模型显示当前具备较强观察价值。");
  if (changesPercentage > 0) strengths.push("短期价格动量为正，市场关注度较好。");
  if (pe !== null && pe > 0 && pe <= 35) strengths.push("PE 处于相对可读区间，估值压力暂不极端。");
  if (eps !== null && eps > 0) strengths.push("EPS 为正，盈利维度有基础支撑。");
  if (marketCap !== null && marketCap >= 100_000_000_000) strengths.push("市值规模较大，稳定性维度获得支撑。");
  if (scoreMode === "market_only") strengths.push("在 ETF/基金数据不完整时，仍可用市场走势进行保守评分。");
  return unique(strengths).slice(0, 5);
}

function getRisks({
  dimensions,
  pe,
  eps,
  marketCap,
  changesPercentage,
  scoreMode,
  quote
}: {
  dimensions: AiScoreDimension[];
  pe: number | null;
  eps: number | null;
  marketCap: number | null;
  changesPercentage: number;
  scoreMode: AiScoreMode;
  quote: Quote;
}) {
  const risks: string[] = [];
  const weakDimensions = dimensions.filter((dimension) => dimension.score < 50);
  weakDimensions.slice(0, 3).forEach((dimension) => risks.push(`${dimension.name} 偏弱，当前维度得分 ${dimension.score}/100。`));
  if (Math.abs(changesPercentage) > 5) risks.push("单日波动较大，短期追涨杀跌风险较高。");
  if (pe === null || pe <= 0) risks.push("PE 缺失或不可读，估值判断需要更多财报数据。");
  if (pe !== null && pe > 80) risks.push("PE 较高，估值回撤风险需要重点关注。");
  if (eps === null || eps <= 0) risks.push("EPS 缺失或不为正，盈利质量需要进一步验证。");
  if (marketCap !== null && marketCap < 10_000_000_000) risks.push("市值规模偏小，价格波动和流动性风险可能更高。");
  if (quote.marketDataSource === "mock") risks.push("当前使用示例行情，结果只适合功能预览。");
  if (scoreMode === "market_only") risks.push("ETF/基金可能没有 PE 或 EPS，六维中部分基本面维度为估算。");
  return unique(risks).slice(0, 6);
}

function getInvestorProfile({ score, changesPercentage, marketCap, scoreMode }: { score: number; changesPercentage: number; marketCap: number | null; scoreMode: AiScoreMode }) {
  if (scoreMode === "market_only") return "适合偏交易型或趋势跟踪型投资者，需接受 ETF/基金基本面数据不完整。";
  if (score >= 85 && Math.abs(changesPercentage) <= 5) return "适合成长型与核心配置型投资者继续深入研究。";
  if (score >= 75) return "适合成长型投资者和中等风险承受能力投资者观察。";
  if (score >= 60) return "适合稳健型投资者放入观察清单，等待更好的价格或数据确认。";
  if (marketCap !== null && marketCap < 10_000_000_000) return "更适合高风险承受能力投资者，小仓位研究即可。";
  return "更适合观望型投资者，暂不适合作为核心仓位依据。";
}

function getAiSummary({
  ticker,
  score,
  ratingLabel,
  dimensions,
  changesPercentage,
  scoreMode,
  baseSource
}: {
  ticker: string;
  score: number;
  ratingLabel: string;
  dimensions: AiScoreDimension[];
  changesPercentage: number;
  scoreMode: AiScoreMode;
  baseSource: AiScoreDataSource;
}) {
  const best = [...dimensions].sort((a, b) => b.score - a.score)[0];
  const weakest = [...dimensions].sort((a, b) => a.score - b.score)[0];
  const dataNote = baseSource === "真实数据" ? "主要基于真实行情数据" : `当前包含${baseSource}`;
  const modeNote = scoreMode === "market_only" ? "由于 PE/EPS 不完整，部分基本面维度使用市场走势估算。" : scoreMode === "estimated" ? "部分缺失字段已用规则模型估算。" : "数据完整度较好。";

  return `${ticker} 当前 AI Score 为 ${score}/100，评级为 ${ratingLabel}。${dataNote}，今日涨跌幅 ${formatPercent(changesPercentage)}。六维中 ${best.name} 相对突出，${weakest.name} 是主要短板。${modeNote} 该结果用于投资研究和教育，不构成买卖建议。`;
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

function getQuoteSource(quote: Quote): AiScoreDataSource {
  if (quote.stale) return "缓存数据";
  if (quote.marketDataSource === "fmp-stable") return "真实数据";
  if (quote.marketDataSource === "yahoo") return "缓存数据";
  return "示例数据";
}

function getEstimatedSource(baseSource: AiScoreDataSource): AiScoreDataSource {
  return baseSource === "示例数据" ? "示例数据" : "估算数据";
}

function getOverallSource(dimensions: AiScoreDimension[], baseSource: AiScoreDataSource): AiScoreDataSource {
  if (baseSource === "示例数据") return "示例数据";
  if (dimensions.some((item) => item.source === "缓存数据")) return "缓存数据";
  if (dimensions.some((item) => item.source === "估算数据")) return "估算数据";
  return "真实数据";
}

function getDataSourceDetails(quote: Quote, dimensions: AiScoreDimension[], isMarketOnly: boolean) {
  const details = [
    `行情来源：${quote.marketDataSource === "fmp" || quote.marketDataSource === "fmp-stable" ? "FMP stable quote" : quote.marketDataSource === "yahoo" ? "Yahoo fallback" : quote.marketDataSource === "cache" ? "server cache" : quote.marketDataSource === "stale-cache" ? "stale server cache" : quote.marketDataSource === "unavailable" ? "unavailable" : "本地示例数据"}`,
    quote.stale ? "当前返回缓存数据。" : "当前返回最新可用数据。",
    isMarketOnly ? "PE/EPS 缺失，ETF/基金或数据不足场景下使用 market-only/估算评分。" : "PE/EPS 可用于基本面维度。"
  ];
  const estimated = dimensions.filter((item) => item.source === "估算数据").map((item) => item.name);
  if (estimated.length) details.push(`估算维度：${estimated.join("、")}。`);
  return details;
}

function getRangePositionScore(price: number, yearLow: number | null, yearHigh: number | null) {
  if (yearLow === null || yearHigh === null || yearHigh <= yearLow || price <= 0) return null;
  const position = (price - yearLow) / (yearHigh - yearLow);
  return clamp(position * 100, 10, 95);
}

function getAiScoreCacheKey(ticker: string) {
  return `ai-score:v2:${ticker.trim().toUpperCase()}`;
}

function nullableNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function numberOrZero(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function unique(items: string[]) {
  return Array.from(new Set(items)).filter(Boolean);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

function formatPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function toMarketQuote(quote: Quote): MarketQuote {
  return {
    symbol: quote.symbol,
    name: quote.name,
    price: quote.price,
    change: quote.change,
    changePercent: quote.changePercent,
    previousClose: quote.previousClose,
    open: quote.open,
    dayHigh: quote.dayHigh,
    dayLow: quote.dayLow,
    volume: quote.volume,
    marketCap: quote.marketCap,
    currency: quote.currency,
    exchange: quote.exchange,
    source: quote.source,
    originalSource: quote.originalSource,
    updatedAt: quote.updatedAt,
    fetchedAt: quote.fetchedAt,
    isStale: quote.isStale,
    isMarketOpen: quote.isMarketOpen,
    error: quote.error
  };
}
















