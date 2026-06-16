import { getCache, getStaleCache, setCache } from "@/lib/cache";
import { getFmpStableQuote } from "@/lib/market-data";

export type AiScoreBreakdownItem = {
  name: string;
  score: number;
  max: number;
  reason: string;
};

export type AiScoreResult = {
  ticker: string;
  price: number;
  pe: number | null;
  eps: number | null;
  marketCap: number | null;
  changesPercentage: number;
  score: number;
  rating: string;
  breakdown: AiScoreBreakdownItem[];
  strengths: string[];
  risks: string[];
  assetType?: "ETF";
  scoreMode?: "full" | "market_only";
  stale?: boolean;
};

export type AiScoreSummary = Pick<AiScoreResult, "ticker" | "score" | "rating" | "price" | "changesPercentage" | "assetType" | "scoreMode" | "stale">;

const scoreCacheTtlMs = 10 * 60 * 1000;

export async function getAiScore(ticker: string, apiKey: string): Promise<AiScoreResult> {
  const normalizedTicker = ticker.trim().toUpperCase();
  const cacheKey = getAiScoreCacheKey(normalizedTicker);
  const cachedScore = getCache<AiScoreResult>(cacheKey);
  if (cachedScore) return cachedScore;

  const staleScore = getStaleCache<AiScoreResult>(cacheKey);

  try {
    const quote = await getFmpStableQuote(normalizedTicker, apiKey);
    if (!quote) {
      throw new Error(`No quote data was found for ${normalizedTicker}. Please check the ticker and try again.`);
    }

    const price = quote.price;
    const pe = nullableNumber(quote.pe);
    const eps = nullableNumber(quote.eps);
    const marketCap = nullableNumber(quote.marketCap);
    const changesPercentage = numberOrZero(quote.changesPercentage);
    const returnedTicker = quote.ticker;

    if (price === null) {
      throw new Error(`FMP did not return a valid current price for ${normalizedTicker}.`);
    }

    const scoreResult = getScoreResult({ changesPercentage, pe, eps, marketCap });

    const result = {
      ticker: returnedTicker,
      price,
      pe,
      eps,
      marketCap,
      changesPercentage,
      score: scoreResult.score,
      rating: getRating(scoreResult.score),
      breakdown: scoreResult.breakdown,
      strengths: getStrengths({ score: scoreResult.score, changesPercentage, pe, eps, marketCap, scoreMode: scoreResult.scoreMode }),
      risks: getRisks({ changesPercentage, pe, eps, marketCap, scoreMode: scoreResult.scoreMode }),
      assetType: "assetType" in scoreResult ? scoreResult.assetType : undefined,
      scoreMode: scoreResult.scoreMode,
      stale: quote.stale
    };

    if (!result.stale) setCache(cacheKey, result, scoreCacheTtlMs);
    return result;
  } catch (error) {
    if (staleScore) return { ...staleScore, stale: true };
    throw error;
  }
}

export function getCachedAiScore(ticker: string): AiScoreResult | null {
  const normalizedTicker = ticker.trim().toUpperCase();
  const cachedScore = getCache<AiScoreResult>(getAiScoreCacheKey(normalizedTicker));
  if (cachedScore) return cachedScore;

  const staleScore = getStaleCache<AiScoreResult>(getAiScoreCacheKey(normalizedTicker));
  return staleScore ? { ...staleScore, stale: true } : null;
}

export function toAiScoreSummary(result: AiScoreResult): AiScoreSummary {
  return {
    ticker: result.ticker,
    score: result.score,
    rating: result.rating,
    price: result.price,
    changesPercentage: result.changesPercentage,
    assetType: result.assetType,
    scoreMode: result.scoreMode,
    stale: result.stale
  };
}

function getAiScoreCacheKey(ticker: string) {
  return `ai-score:${ticker.trim().toUpperCase()}`;
}

function getScoreResult(input: {
  changesPercentage: number;
  pe: number | null;
  eps: number | null;
  marketCap: number | null;
}) {
  if (input.pe === null && input.eps === null) {
    return scoreMarketOnly(input);
  }

  return scoreFullMode(input);
}

function scoreFullMode({
  changesPercentage,
  pe,
  eps,
  marketCap
}: {
  changesPercentage: number;
  pe: number | null;
  eps: number | null;
  marketCap: number | null;
}) {
  const breakdown: AiScoreBreakdownItem[] = [];
  const trendScore = changesPercentage > 3 ? 20 : changesPercentage >= 0 ? 15 : changesPercentage >= -3 ? 10 : 5;
  const absMove = Math.abs(changesPercentage);
  const riskScore = absMove <= 2 ? 18 : absMove <= 5 ? 14 : absMove <= 10 ? 10 : 6;

  breakdown.push({
    name: "价格趋势",
    score: trendScore,
    max: 20,
    reason: `今日涨跌幅为 ${formatPercent(changesPercentage)}，按短期趋势规则计 ${trendScore} 分。`
  });

  if (pe !== null) {
    const peScore = pe <= 0 ? 8 : pe < 25 ? 18 : pe <= 50 ? 14 : pe <= 100 ? 10 : 6;
    breakdown.push({
      name: "估值 PE",
      score: peScore,
      max: 20,
      reason: pe <= 0 ? "PE 小于等于 0，按保守规则计 8 分。" : `PE 为 ${formatNumber(pe)}，按估值区间计 ${peScore} 分。`
    });
  }

  if (eps !== null) {
    const epsScore = eps <= 0 ? 5 : eps > 10 ? 20 : eps >= 3 ? 16 : 12;
    breakdown.push({
      name: "盈利能力 EPS",
      score: epsScore,
      max: 20,
      reason: `EPS 为 ${formatNumber(eps)}，按盈利能力规则计 ${epsScore} 分。`
    });
  }

  if (marketCap !== null) {
    const marketCapScore = marketCap > 1_000_000_000_000 ? 20 : marketCap >= 100_000_000_000 ? 16 : marketCap >= 10_000_000_000 ? 12 : 8;
    breakdown.push({
      name: "市值稳定性",
      score: marketCapScore,
      max: 20,
      reason: `市值约 ${formatMarketCap(marketCap)}，按规模稳定性规则计 ${marketCapScore} 分。`
    });
  }

  breakdown.push({
    name: "风险调整",
    score: riskScore,
    max: 20,
    reason: `涨跌幅绝对值为 ${formatPercent(absMove)}，按波动风险规则计 ${riskScore} 分。`
  });

  return {
    breakdown,
    score: normalizeScore(breakdown),
    scoreMode: "full" as const
  };
}

function scoreMarketOnly({ changesPercentage }: { changesPercentage: number; pe: number | null; eps: number | null; marketCap: number | null }) {
  const trendScore = changesPercentage > 3 ? 40 : changesPercentage >= 0 ? 30 : changesPercentage >= -3 ? 20 : 10;
  const absMove = Math.abs(changesPercentage);
  const volatilityScore = absMove <= 2 ? 35 : absMove <= 5 ? 28 : absMove <= 10 ? 18 : 10;
  const completenessScore = 20;
  const breakdown: AiScoreBreakdownItem[] = [
    {
      name: "价格趋势",
      score: trendScore,
      max: 40,
      reason: `今日涨跌幅为 ${formatPercent(changesPercentage)}，按市场走势规则计 ${trendScore} 分。`
    },
    {
      name: "波动风险",
      score: volatilityScore,
      max: 40,
      reason: `涨跌幅绝对值为 ${formatPercent(absMove)}，按波动风险规则计 ${volatilityScore} 分。`
    },
    {
      name: "数据完整性",
      score: completenessScore,
      max: 20,
      reason: "已取得价格和涨跌幅，按市场数据完整性规则计 20 分。"
    }
  ];

  return {
    breakdown,
    score: normalizeScore(breakdown),
    assetType: "ETF" as const,
    scoreMode: "market_only" as const
  };
}

function normalizeScore(breakdown: AiScoreBreakdownItem[]) {
  const totalScore = breakdown.reduce((total, item) => total + item.score, 0);
  const totalMax = breakdown.reduce((total, item) => total + item.max, 0);
  if (totalMax <= 0) return 0;
  return Math.round((totalScore / totalMax) * 100);
}

function getRating(score: number) {
  if (score >= 80) return "Strong Watch / 强烈关注";
  if (score >= 65) return "Watch / 值得观察";
  if (score >= 50) return "Neutral / 中性";
  return "High Risk / 高风险";
}

function getStrengths({
  score,
  changesPercentage,
  pe,
  eps,
  marketCap,
  scoreMode
}: {
  score: number;
  changesPercentage: number;
  pe: number | null;
  eps: number | null;
  marketCap: number | null;
  scoreMode?: "full" | "market_only";
}) {
  const strengths: string[] = [];
  if (scoreMode === "market_only") strengths.push("使用价格和涨跌幅进行市场走势评分。");
  if (score >= 80) strengths.push("综合评分较高，多个基础维度表现均衡。");
  if (changesPercentage > 0) strengths.push("短期价格趋势为正。");
  if (pe !== null && pe > 0 && pe < 50) strengths.push("PE 处于 V1 规则的可观察区间。");
  if (eps !== null && eps > 3) strengths.push("EPS 显示公司具备正向盈利能力。");
  if (marketCap !== null && marketCap >= 100_000_000_000) strengths.push("市值规模较大，稳定性评分较好。");
  return strengths.length ? strengths : ["暂无明显优势，建议结合更多基本面和行业信息观察。"];
}

function getRisks({
  changesPercentage,
  pe,
  eps,
  marketCap,
  scoreMode
}: {
  changesPercentage: number;
  pe: number | null;
  eps: number | null;
  marketCap: number | null;
  scoreMode?: "full" | "market_only";
}) {
  const risks: string[] = [];
  if (scoreMode === "market_only") risks.push("ETF/基金可能没有 PE 或 EPS，评分不包含估值和盈利能力。");
  if (Math.abs(changesPercentage) > 5) risks.push("当日波动较大，短期风险较高。");
  if (scoreMode !== "market_only" && (pe === null || pe <= 0)) risks.push("PE 缺失或为负，估值可读性较弱。");
  if (pe !== null && pe > 100) risks.push("PE 较高，估值压力可能偏大。");
  if (scoreMode !== "market_only" && (eps === null || eps <= 0)) risks.push("EPS 缺失或不为正，盈利能力存在不确定性。");
  if (marketCap !== null && marketCap < 10_000_000_000) risks.push("市值规模较小，稳定性评分偏低。");
  return risks.length ? risks : ["V1 规则未发现突出的单项风险，但仍需自行研究。"];
}

function nullableNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function numberOrZero(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

function formatPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatMarketCap(value: number) {
  if (value >= 1_000_000_000_000) return `${formatNumber(value / 1_000_000_000_000)}T USD`;
  if (value >= 1_000_000_000) return `${formatNumber(value / 1_000_000_000)}B USD`;
  return `${formatNumber(value / 1_000_000)}M USD`;
}
