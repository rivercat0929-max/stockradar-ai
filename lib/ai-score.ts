import { getCache, getStaleCache, setCache } from "@/lib/cache";
import { getQuote, type MarketQuote, type Quote } from "@/lib/market-data";

export type AiScoreDataSource = "真实数据" | "缓存数据" | "估算数据" | "示例数据" | "çœŸå®žæ•°æ®" | "ç¼“å­˜æ•°æ®" | "ä¼°ç®—æ•°æ®" | "ç¤ºä¾‹æ•°æ®";
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
    if (staleScore) return { ...staleScore, stale: true, dataSource: "ç¼“å­˜æ•°æ®" };
    throw error;
  }
}

export function getCachedAiScore(ticker: string): AiScoreResult | null {
  const normalizedTicker = ticker.trim().toUpperCase();
  const cachedScore = getCache<AiScoreResult>(getAiScoreCacheKey(normalizedTicker));
  if (cachedScore) return cachedScore;

  const staleScore = getStaleCache<AiScoreResult>(getAiScoreCacheKey(normalizedTicker));
  return staleScore ? { ...staleScore, stale: true, dataSource: "ç¼“å­˜æ•°æ®" } : null;
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
  const scoreMode: AiScoreMode = isMarketOnly ? "market_only" : dimensions.some((item) => item.source === "ä¼°ç®—æ•°æ®") ? "estimated" : "full";
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
    { key: "trend" as const, name: "è¶‹åŠ¿ Trend", weight: 20, ...trend },
    { key: "growth" as const, name: "æˆé•¿ Growth", weight: 20, ...growth },
    { key: "valuation" as const, name: "ä¼°å€¼ Valuation", weight: 15, ...valuation },
    { key: "quality" as const, name: "ç›ˆåˆ© Quality", weight: 15, ...quality },
    { key: "sentiment" as const, name: "æƒ…ç»ª Sentiment", weight: 15, ...sentiment },
    { key: "risk" as const, name: "é£Žé™© Risk", weight: 15, ...risk }
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
      ? `æ¶¨è·Œå¹…ä¸º ${formatPercent(changesPercentage)}ï¼Œç¼ºå°‘52å‘¨åŒºé—´æ—¶ä¸»è¦æŒ‰çŸ­æœŸè¶‹åŠ¿ä¼°ç®—ã€‚`
      : `æ¶¨è·Œå¹…ä¸º ${formatPercent(changesPercentage)}ï¼Œå¹¶ç»“åˆ52å‘¨ä»·æ ¼åŒºé—´ä½ç½®è®¡ç®—è¶‹åŠ¿ã€‚`
  };
}

function scoreGrowth({ changesPercentage, eps, marketCap, isMarketOnly }: { changesPercentage: number; eps: number | null; marketCap: number | null; isMarketOnly: boolean }) {
  if (eps !== null) {
    const epsBase = eps > 10 ? 88 : eps >= 3 ? 74 : eps > 0 ? 58 : 25;
    const sizeBoost = marketCap !== null && marketCap >= 100_000_000_000 ? 6 : 0;
    return {
      score: epsBase + sizeBoost + Math.max(-8, Math.min(8, changesPercentage)),
      source: "çœŸå®žæ•°æ®" as const,
      reason: `EPS ä¸º ${formatNumber(eps)}ï¼Œç»“åˆå¸‚å€¼è§„æ¨¡å’ŒçŸ­æœŸåŠ¨é‡è¯„ä¼°æˆé•¿è´¨é‡ã€‚`
    };
  }

  const estimate = 52 + Math.max(-12, Math.min(12, changesPercentage * 2)) + (marketCap !== null && marketCap >= 100_000_000_000 ? 6 : 0);
  return {
    score: isMarketOnly ? Math.min(68, estimate) : estimate,
    source: "ä¼°ç®—æ•°æ®" as const,
    reason: isMarketOnly ? "ETF/åŸºé‡‘é€šå¸¸ç¼ºå°‘ EPSï¼Œæˆé•¿ç»´åº¦ä½¿ç”¨ä»·æ ¼åŠ¨é‡å’Œè§„æ¨¡è¿›è¡Œä¿å®ˆä¼°ç®—ã€‚" : "ç¼ºå°‘ EPSï¼Œæˆé•¿ç»´åº¦ä½¿ç”¨ä»·æ ¼åŠ¨é‡å’Œå¸‚å€¼è§„æ¨¡ä¼°ç®—ã€‚"
  };
}

function scoreValuation({ pe, isMarketOnly, trendScore }: { pe: number | null; isMarketOnly: boolean; trendScore: number }) {
  if (pe !== null) {
    const score = pe <= 0 ? 35 : pe < 20 ? 88 : pe <= 35 ? 74 : pe <= 60 ? 58 : pe <= 100 ? 42 : 25;
    return {
      score,
      source: "çœŸå®žæ•°æ®" as const,
      reason: pe <= 0 ? "PE å°äºŽç­‰äºŽ0ï¼Œä¼°å€¼å¯è¯»æ€§è¾ƒå¼±ï¼ŒæŒ‰ä¿å®ˆè§„åˆ™è®¡åˆ†ã€‚" : `PE ä¸º ${formatNumber(pe)}ï¼ŒæŒ‰ä¼°å€¼åŒºé—´è®¡åˆ†ã€‚`
    };
  }

  return {
    score: isMarketOnly ? Math.min(62, trendScore * 0.75) : 50,
    source: "ä¼°ç®—æ•°æ®" as const,
    reason: isMarketOnly ? "ETF/åŸºé‡‘å¯èƒ½æ²¡æœ‰ PEï¼Œä¼°å€¼ç»´åº¦ä½¿ç”¨å¸‚åœºèµ°åŠ¿ä¿å®ˆä¼°ç®—ã€‚" : "ç¼ºå°‘ PEï¼Œä¼°å€¼ç»´åº¦æŒ‰ä¸­æ€§åä¿å®ˆä¼°ç®—ã€‚"
  };
}

function scoreQuality({ eps, marketCap, isMarketOnly }: { eps: number | null; marketCap: number | null; isMarketOnly: boolean }) {
  if (eps !== null) {
    const epsScore = eps > 10 ? 92 : eps >= 3 ? 78 : eps > 0 ? 60 : 25;
    const capScore = marketCap === null ? 50 : marketCap > 1_000_000_000_000 ? 95 : marketCap >= 100_000_000_000 ? 82 : marketCap >= 10_000_000_000 ? 62 : 45;
    return {
      score: epsScore * 0.7 + capScore * 0.3,
      source: marketCap === null ? "ä¼°ç®—æ•°æ®" as const : "çœŸå®žæ•°æ®" as const,
      reason: `EPS ä¸º ${formatNumber(eps)}ï¼Œå¹¶ç»“åˆå¸‚å€¼ç¨³å®šæ€§è¡¡é‡ç›ˆåˆ©è´¨é‡ã€‚`
    };
  }

  const estimate = marketCap === null ? 48 : marketCap >= 100_000_000_000 ? 62 : 52;
  return {
    score: isMarketOnly ? Math.min(60, estimate) : estimate,
    source: "ä¼°ç®—æ•°æ®" as const,
    reason: isMarketOnly ? "ETF/åŸºé‡‘å¯èƒ½æ²¡æœ‰ EPSï¼Œç›ˆåˆ©è´¨é‡ç»´åº¦æŒ‰åŸºé‡‘ç±»èµ„äº§ä¿å®ˆä¼°ç®—ã€‚" : "ç¼ºå°‘ EPSï¼Œç›ˆåˆ©è´¨é‡ç»´åº¦æŒ‰å¸‚å€¼ç¨³å®šæ€§ä¼°ç®—ã€‚"
  };
}

function scoreSentiment({ quote, changesPercentage, baseSource }: { quote: Quote; changesPercentage: number; baseSource: AiScoreDataSource }) {
  const moveScore = changesPercentage > 5 ? 92 : changesPercentage > 2 ? 80 : changesPercentage >= 0 ? 66 : changesPercentage >= -2 ? 46 : 30;
  const volumeScore = quote.volume ? clamp(55 + Math.log10(Math.max(quote.volume, 1)) * 4, 45, 85) : null;

  return {
    score: volumeScore === null ? moveScore : moveScore * 0.75 + volumeScore * 0.25,
    source: volumeScore === null ? getEstimatedSource(baseSource) : baseSource,
    reason: volumeScore === null
      ? `æƒ…ç»ªç»´åº¦ä¸»è¦å‚è€ƒä»Šæ—¥æ¶¨è·Œå¹… ${formatPercent(changesPercentage)}ï¼Œæˆäº¤é‡æ•°æ®ä¸è¶³ã€‚`
      : `æƒ…ç»ªç»´åº¦ç»“åˆä»Šæ—¥æ¶¨è·Œå¹… ${formatPercent(changesPercentage)} å’Œæˆäº¤é‡ã€‚`
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
    reason: `é£Žé™©ç»´åº¦æŒ‰æ³¢åŠ¨å¹…åº¦ ${formatPercent(absMove)}ã€å¸‚å€¼è§„æ¨¡å’Œæ—¥å†…æŒ¯å¹…ç»¼åˆè®¡ç®—ã€‚`
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
    if (dimension.score >= 70) strengths.push(`${dimension.name} è¡¨çŽ°è¾ƒå¥½ï¼Œå½“å‰ç»´åº¦å¾—åˆ† ${dimension.score}/100ã€‚`);
  });
  if (score >= 75) strengths.push("ç»¼åˆè¯„åˆ†è¾ƒé«˜ï¼Œå…­ç»´æ¨¡åž‹æ˜¾ç¤ºå½“å‰å…·å¤‡è¾ƒå¼ºè§‚å¯Ÿä»·å€¼ã€‚");
  if (changesPercentage > 0) strengths.push("çŸ­æœŸä»·æ ¼åŠ¨é‡ä¸ºæ­£ï¼Œå¸‚åœºå…³æ³¨åº¦è¾ƒå¥½ã€‚");
  if (pe !== null && pe > 0 && pe <= 35) strengths.push("PE å¤„äºŽç›¸å¯¹å¯è¯»åŒºé—´ï¼Œä¼°å€¼åŽ‹åŠ›æš‚ä¸æžç«¯ã€‚");
  if (eps !== null && eps > 0) strengths.push("EPS ä¸ºæ­£ï¼Œç›ˆåˆ©ç»´åº¦æœ‰åŸºç¡€æ”¯æ’‘ã€‚");
  if (marketCap !== null && marketCap >= 100_000_000_000) strengths.push("å¸‚å€¼è§„æ¨¡è¾ƒå¤§ï¼Œç¨³å®šæ€§ç»´åº¦èŽ·å¾—æ”¯æ’‘ã€‚");
  if (scoreMode === "market_only") strengths.push("åœ¨ ETF/åŸºé‡‘æ•°æ®ä¸å®Œæ•´æ—¶ï¼Œä»å¯ç”¨å¸‚åœºèµ°åŠ¿è¿›è¡Œä¿å®ˆè¯„åˆ†ã€‚");
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
  weakDimensions.slice(0, 3).forEach((dimension) => risks.push(`${dimension.name} åå¼±ï¼Œå½“å‰ç»´åº¦å¾—åˆ† ${dimension.score}/100ã€‚`));
  if (Math.abs(changesPercentage) > 5) risks.push("å•æ—¥æ³¢åŠ¨è¾ƒå¤§ï¼ŒçŸ­æœŸè¿½æ¶¨æ€è·Œé£Žé™©è¾ƒé«˜ã€‚");
  if (pe === null || pe <= 0) risks.push("PE ç¼ºå¤±æˆ–ä¸å¯è¯»ï¼Œä¼°å€¼åˆ¤æ–­éœ€è¦æ›´å¤šè´¢æŠ¥æ•°æ®ã€‚");
  if (pe !== null && pe > 80) risks.push("PE è¾ƒé«˜ï¼Œä¼°å€¼å›žæ’¤é£Žé™©éœ€è¦é‡ç‚¹å…³æ³¨ã€‚");
  if (eps === null || eps <= 0) risks.push("EPS ç¼ºå¤±æˆ–ä¸ä¸ºæ­£ï¼Œç›ˆåˆ©è´¨é‡éœ€è¦è¿›ä¸€æ­¥éªŒè¯ã€‚");
  if (marketCap !== null && marketCap < 10_000_000_000) risks.push("å¸‚å€¼è§„æ¨¡åå°ï¼Œä»·æ ¼æ³¢åŠ¨å’ŒæµåŠ¨æ€§é£Žé™©å¯èƒ½æ›´é«˜ã€‚");
  if (quote.marketDataSource === "mock") risks.push("å½“å‰ä½¿ç”¨ç¤ºä¾‹è¡Œæƒ…ï¼Œç»“æžœåªé€‚åˆåŠŸèƒ½é¢„è§ˆã€‚");
  if (scoreMode === "market_only") risks.push("ETF/åŸºé‡‘å¯èƒ½æ²¡æœ‰ PE æˆ– EPSï¼Œå…­ç»´ä¸­éƒ¨åˆ†åŸºæœ¬é¢ç»´åº¦ä¸ºä¼°ç®—ã€‚");
  return unique(risks).slice(0, 6);
}

function getInvestorProfile({ score, changesPercentage, marketCap, scoreMode }: { score: number; changesPercentage: number; marketCap: number | null; scoreMode: AiScoreMode }) {
  if (scoreMode === "market_only") return "é€‚åˆåäº¤æ˜“åž‹æˆ–è¶‹åŠ¿è·Ÿè¸ªåž‹æŠ•èµ„è€…ï¼Œéœ€æŽ¥å— ETF/åŸºé‡‘åŸºæœ¬é¢æ•°æ®ä¸å®Œæ•´ã€‚";
  if (score >= 85 && Math.abs(changesPercentage) <= 5) return "é€‚åˆæˆé•¿åž‹ä¸Žæ ¸å¿ƒé…ç½®åž‹æŠ•èµ„è€…ç»§ç»­æ·±å…¥ç ”ç©¶ã€‚";
  if (score >= 75) return "é€‚åˆæˆé•¿åž‹æŠ•èµ„è€…å’Œä¸­ç­‰é£Žé™©æ‰¿å—èƒ½åŠ›æŠ•èµ„è€…è§‚å¯Ÿã€‚";
  if (score >= 60) return "é€‚åˆç¨³å¥åž‹æŠ•èµ„è€…æ”¾å…¥è§‚å¯Ÿæ¸…å•ï¼Œç­‰å¾…æ›´å¥½çš„ä»·æ ¼æˆ–æ•°æ®ç¡®è®¤ã€‚";
  if (marketCap !== null && marketCap < 10_000_000_000) return "æ›´é€‚åˆé«˜é£Žé™©æ‰¿å—èƒ½åŠ›æŠ•èµ„è€…ï¼Œå°ä»“ä½ç ”ç©¶å³å¯ã€‚";
  return "æ›´é€‚åˆè§‚æœ›åž‹æŠ•èµ„è€…ï¼Œæš‚ä¸é€‚åˆä½œä¸ºæ ¸å¿ƒä»“ä½ä¾æ®ã€‚";
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
  const dataNote = baseSource === "çœŸå®žæ•°æ®" ? "ä¸»è¦åŸºäºŽçœŸå®žè¡Œæƒ…æ•°æ®" : `å½“å‰åŒ…å«${baseSource}`;
  const modeNote = scoreMode === "market_only" ? "ç”±äºŽ PE/EPS ä¸å®Œæ•´ï¼Œéƒ¨åˆ†åŸºæœ¬é¢ç»´åº¦ä½¿ç”¨å¸‚åœºèµ°åŠ¿ä¼°ç®—ã€‚" : scoreMode === "estimated" ? "éƒ¨åˆ†ç¼ºå¤±å­—æ®µå·²ç”¨è§„åˆ™æ¨¡åž‹ä¼°ç®—ã€‚" : "æ•°æ®å®Œæ•´åº¦è¾ƒå¥½ã€‚";

  return `${ticker} å½“å‰ AI Score ä¸º ${score}/100ï¼Œè¯„çº§ä¸º ${ratingLabel}ã€‚${dataNote}ï¼Œä»Šæ—¥æ¶¨è·Œå¹… ${formatPercent(changesPercentage)}ã€‚å…­ç»´ä¸­ ${best.name} ç›¸å¯¹çªå‡ºï¼Œ${weakest.name} æ˜¯ä¸»è¦çŸ­æ¿ã€‚${modeNote} è¯¥ç»“æžœç”¨äºŽæŠ•èµ„ç ”ç©¶å’Œæ•™è‚²ï¼Œä¸æž„æˆä¹°å–å»ºè®®ã€‚`;
}

function getRating(score: number) {
  if (score >= 85) return "Strong Buy";
  if (score >= 75) return "Buy";
  if (score >= 60) return "Hold";
  if (score >= 45) return "Watch";
  return "Avoid";
}

function getRatingLabel(rating: string) {
  if (rating === "Strong Buy") return "å¼ºçƒˆä¹°å…¥è§‚å¯Ÿ";
  if (rating === "Buy") return "ä¹°å…¥è§‚å¯Ÿ";
  if (rating === "Hold") return "æŒæœ‰è§‚å¯Ÿ";
  if (rating === "Watch") return "è°¨æ…Žè§‚å¯Ÿ";
  return "å›žé¿";
}

function getQuoteSource(quote: Quote): AiScoreDataSource {
  if (quote.stale) return "ç¼“å­˜æ•°æ®";
  if (quote.marketDataSource === "fmp-stable") return "çœŸå®žæ•°æ®";
  if (quote.marketDataSource === "yahoo") return "ç¼“å­˜æ•°æ®";
  return "ç¤ºä¾‹æ•°æ®";
}

function getEstimatedSource(baseSource: AiScoreDataSource): AiScoreDataSource {
  return baseSource === "ç¤ºä¾‹æ•°æ®" ? "ç¤ºä¾‹æ•°æ®" : "ä¼°ç®—æ•°æ®";
}

function getOverallSource(dimensions: AiScoreDimension[], baseSource: AiScoreDataSource): AiScoreDataSource {
  if (baseSource === "ç¤ºä¾‹æ•°æ®") return "ç¤ºä¾‹æ•°æ®";
  if (dimensions.some((item) => item.source === "ç¼“å­˜æ•°æ®")) return "ç¼“å­˜æ•°æ®";
  if (dimensions.some((item) => item.source === "ä¼°ç®—æ•°æ®")) return "ä¼°ç®—æ•°æ®";
  return "çœŸå®žæ•°æ®";
}

function getDataSourceDetails(quote: Quote, dimensions: AiScoreDimension[], isMarketOnly: boolean) {
  const details = [
    `è¡Œæƒ…æ¥æºï¼š${quote.marketDataSource === "fmp" || quote.marketDataSource === "fmp-stable" ? "FMP stable quote" : quote.marketDataSource === "yahoo" ? "Yahoo fallback" : quote.marketDataSource === "cache" ? "server cache" : quote.marketDataSource === "stale-cache" ? "stale server cache" : quote.marketDataSource === "unavailable" ? "unavailable" : "æœ¬åœ°ç¤ºä¾‹æ•°æ®"}`,
    quote.stale ? "å½“å‰è¿”å›žç¼“å­˜æ•°æ®ã€‚" : "å½“å‰è¿”å›žæœ€æ–°å¯ç”¨æ•°æ®ã€‚",
    isMarketOnly ? "PE/EPS ç¼ºå¤±ï¼ŒETF/åŸºé‡‘æˆ–æ•°æ®ä¸è¶³åœºæ™¯ä¸‹ä½¿ç”¨ market-only/ä¼°ç®—è¯„åˆ†ã€‚" : "PE/EPS å¯ç”¨äºŽåŸºæœ¬é¢ç»´åº¦ã€‚"
  ];
  const estimated = dimensions.filter((item) => item.source === "ä¼°ç®—æ•°æ®").map((item) => item.name);
  if (estimated.length) details.push(`ä¼°ç®—ç»´åº¦ï¼š${estimated.join("ã€")}ã€‚`);
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














