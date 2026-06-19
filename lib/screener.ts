import { getAiScore, type AiScoreDataSource } from "@/lib/ai-score";
import { getQuote } from "@/lib/market-data";

export type ScreenerPreset = "growth" | "value" | "ai_strength" | "quality" | "oversold" | "large_cap";

export type ScreenerFilters = {
  minMarketCap?: number;
  maxMarketCap?: number;
  minPe?: number;
  maxPe?: number;
  minEps?: number;
  maxEps?: number;
  minRevenueGrowth?: number;
  minGrossMargin?: number;
  minNetMargin?: number;
  minRoe?: number;
  industry?: string;
  minAiScore?: number;
  minVolume?: number;
  preset?: ScreenerPreset;
};

export type ScreenerResultItem = {
  ticker: string;
  companyName: string;
  industry: string;
  price: number;
  marketCap: number | null;
  pe: number | null;
  eps: number | null;
  volume: number | null;
  revenueGrowth: number;
  grossMargin: number;
  netMargin: number;
  roe: number;
  aiScore: number;
  rating: string;
  ratingLabel: string;
  matchReasons: string[];
  dataSource: AiScoreDataSource;
  dataSourceDetails: string[];
  aiSummary: string;
};

export type ScreenerResponse = {
  stockPool: string[];
  poolNotice: string;
  results: ScreenerResultItem[];
  errors: Array<{ ticker: string; error: string }>;
  dataNotice: string | null;
  dataSources: {
    real: number;
    cached: number;
    estimated: number;
    mock: number;
  };
};

type StockProfile = {
  ticker: string;
  companyName: string;
  industry: string;
  revenueGrowth: number;
  grossMargin: number;
  netMargin: number;
  roe: number;
};

export const screenerStockPool = [
  "TSLA",
  "NVDA",
  "AMZN",
  "MSFT",
  "AAPL",
  "GOOGL",
  "META",
  "PLTR",
  "AMD",
  "AVGO",
  "CEG",
  "COST",
  "V",
  "MA",
  "JPM",
  "UNH",
  "LLY",
  "NVO",
  "SOFI",
  "CRWD",
  "NET",
  "ASML",
  "TSM",
  "NFLX"
];

const stockProfiles: Record<string, StockProfile> = {
  TSLA: { ticker: "TSLA", companyName: "Tesla, Inc.", industry: "电动车", revenueGrowth: 2.5, grossMargin: 17.9, netMargin: 7.3, roe: 10.4 },
  NVDA: { ticker: "NVDA", companyName: "NVIDIA Corporation", industry: "半导体", revenueGrowth: 125.8, grossMargin: 75.0, netMargin: 48.9, roe: 69.2 },
  AMZN: { ticker: "AMZN", companyName: "Amazon.com, Inc.", industry: "互联网零售", revenueGrowth: 11.8, grossMargin: 48.0, netMargin: 9.3, roe: 22.1 },
  MSFT: { ticker: "MSFT", companyName: "Microsoft Corporation", industry: "软件", revenueGrowth: 15.7, grossMargin: 69.4, netMargin: 35.6, roe: 35.1 },
  AAPL: { ticker: "AAPL", companyName: "Apple Inc.", industry: "消费电子", revenueGrowth: 2.0, grossMargin: 46.2, netMargin: 23.9, roe: 151.0 },
  GOOGL: { ticker: "GOOGL", companyName: "Alphabet Inc.", industry: "互联网服务", revenueGrowth: 13.9, grossMargin: 58.1, netMargin: 26.7, roe: 30.8 },
  META: { ticker: "META", companyName: "Meta Platforms, Inc.", industry: "互联网服务", revenueGrowth: 21.9, grossMargin: 81.0, netMargin: 34.1, roe: 36.4 },
  PLTR: { ticker: "PLTR", companyName: "Palantir Technologies Inc.", industry: "软件", revenueGrowth: 25.6, grossMargin: 80.2, netMargin: 16.1, roe: 12.7 },
  AMD: { ticker: "AMD", companyName: "Advanced Micro Devices, Inc.", industry: "半导体", revenueGrowth: 13.7, grossMargin: 49.0, netMargin: 5.8, roe: 3.9 },
  AVGO: { ticker: "AVGO", companyName: "Broadcom Inc.", industry: "半导体", revenueGrowth: 43.9, grossMargin: 64.0, netMargin: 24.6, roe: 22.0 },
  CEG: { ticker: "CEG", companyName: "Constellation Energy Corporation", industry: "公用事业", revenueGrowth: 2.8, grossMargin: 21.1, netMargin: 8.9, roe: 18.3 },
  COST: { ticker: "COST", companyName: "Costco Wholesale Corporation", industry: "零售", revenueGrowth: 5.0, grossMargin: 12.6, netMargin: 2.9, roe: 31.2 },
  V: { ticker: "V", companyName: "Visa Inc.", industry: "支付", revenueGrowth: 10.2, grossMargin: 80.1, netMargin: 53.9, roe: 46.0 },
  MA: { ticker: "MA", companyName: "Mastercard Incorporated", industry: "支付", revenueGrowth: 12.9, grossMargin: 100.0, netMargin: 45.7, roe: 169.0 },
  JPM: { ticker: "JPM", companyName: "JPMorgan Chase & Co.", industry: "金融", revenueGrowth: 14.6, grossMargin: 0, netMargin: 28.2, roe: 16.9 },
  UNH: { ticker: "UNH", companyName: "UnitedHealth Group Incorporated", industry: "医疗保险", revenueGrowth: 7.7, grossMargin: 24.8, netMargin: 3.6, roe: 15.5 },
  LLY: { ticker: "LLY", companyName: "Eli Lilly and Company", industry: "制药", revenueGrowth: 31.9, grossMargin: 80.8, netMargin: 17.4, roe: 48.5 },
  NVO: { ticker: "NVO", companyName: "Novo Nordisk A/S", industry: "制药", revenueGrowth: 25.7, grossMargin: 84.6, netMargin: 35.0, roe: 75.6 },
  SOFI: { ticker: "SOFI", companyName: "SoFi Technologies, Inc.", industry: "金融科技", revenueGrowth: 26.2, grossMargin: 82.1, netMargin: 2.4, roe: 1.8 },
  CRWD: { ticker: "CRWD", companyName: "CrowdStrike Holdings, Inc.", industry: "网络安全", revenueGrowth: 29.4, grossMargin: 75.2, netMargin: 4.8, roe: 7.4 },
  NET: { ticker: "NET", companyName: "Cloudflare, Inc.", industry: "云计算", revenueGrowth: 30.5, grossMargin: 77.5, netMargin: -5.2, roe: -9.0 },
  ASML: { ticker: "ASML", companyName: "ASML Holding N.V.", industry: "半导体设备", revenueGrowth: -1.6, grossMargin: 51.3, netMargin: 28.7, roe: 54.0 },
  TSM: { ticker: "TSM", companyName: "Taiwan Semiconductor Manufacturing Company", industry: "半导体", revenueGrowth: 24.9, grossMargin: 53.8, netMargin: 38.8, roe: 27.7 },
  NFLX: { ticker: "NFLX", companyName: "Netflix, Inc.", industry: "流媒体", revenueGrowth: 15.7, grossMargin: 45.3, netMargin: 20.7, roe: 32.0 }
};

export async function runStockScreener(filters: ScreenerFilters): Promise<ScreenerResponse> {
  const effectiveFilters = applyPreset(filters);
  const errors: Array<{ ticker: string; error: string }> = [];
  const settled = await Promise.allSettled(
    screenerStockPool.map(async (ticker) => {
      const [score, quote] = await Promise.all([getAiScore(ticker), getQuote(ticker)]);
      return toScreenerItem(score, quote.volume);
    })
  );

  const items = settled.flatMap((item, index) => {
    if (item.status === "fulfilled") return [item.value];
    errors.push({ ticker: screenerStockPool[index], error: item.reason instanceof Error ? item.reason.message : "数据暂不可用" });
    return [];
  });

  const results = items
    .filter((item) => matchesFilters(item, effectiveFilters))
    .map((item) => ({
      ...item,
      matchReasons: getMatchReasons(item, effectiveFilters)
    }))
    .sort((a, b) => b.aiScore - a.aiScore);

  return {
    stockPool: screenerStockPool,
    poolNotice: "V1 当前基于精选股票池筛选，后续将扩展至全市场。",
    results,
    errors,
    dataNotice: hasNonRealData(results) || errors.length ? "部分数据为缓存/估算结果。" : null,
    dataSources: {
      real: results.filter((item) => item.dataSource === "真实数据").length,
      cached: results.filter((item) => item.dataSource === "缓存数据").length,
      estimated: results.filter((item) => item.dataSource === "估算数据").length,
      mock: results.filter((item) => item.dataSource === "示例数据").length
    }
  };
}

export function applyPreset(filters: ScreenerFilters): ScreenerFilters {
  const preset = filters.preset;
  if (!preset) return filters;

  const presets: Record<ScreenerPreset, ScreenerFilters> = {
    growth: { minRevenueGrowth: 20, minAiScore: 60 },
    value: { maxPe: 35, minEps: 0, minAiScore: 55 },
    ai_strength: { minAiScore: 75 },
    quality: { minGrossMargin: 50, minNetMargin: 15, minRoe: 15, minAiScore: 60 },
    oversold: { minAiScore: 45, maxPe: 80 },
    large_cap: { minMarketCap: 100_000_000_000, minAiScore: 55 }
  };

  return { ...presets[preset], ...filters };
}

function toScreenerItem(score: Awaited<ReturnType<typeof getAiScore>>, volume: number | null): ScreenerResultItem {
  const profile = stockProfiles[score.ticker] ?? {
    ticker: score.ticker,
    companyName: score.ticker,
    industry: "其他",
    revenueGrowth: 0,
    grossMargin: 0,
    netMargin: 0,
    roe: 0
  };

  return {
    ticker: score.ticker,
    companyName: profile.companyName,
    industry: profile.industry,
    price: score.price,
    marketCap: score.marketCap,
    pe: score.pe,
    eps: score.eps,
    volume,
    revenueGrowth: profile.revenueGrowth,
    grossMargin: profile.grossMargin,
    netMargin: profile.netMargin,
    roe: profile.roe,
    aiScore: score.score,
    rating: score.rating,
    ratingLabel: score.ratingLabel,
    matchReasons: [],
    dataSource: score.dataSource,
    dataSourceDetails: [
      ...score.dataSourceDetails,
      "行业、营收增长率、毛利率、净利率、ROE 为 V1 精选股票池内置资料。"
    ],
    aiSummary: score.aiSummary
  };
}

function matchesFilters(item: ScreenerResultItem, filters: ScreenerFilters) {
  return (
    isInRange(item.marketCap, filters.minMarketCap, filters.maxMarketCap) &&
    isInRange(item.pe, filters.minPe, filters.maxPe) &&
    isInRange(item.eps, filters.minEps, filters.maxEps) &&
    item.revenueGrowth >= numberOrMin(filters.minRevenueGrowth) &&
    item.grossMargin >= numberOrMin(filters.minGrossMargin) &&
    item.netMargin >= numberOrMin(filters.minNetMargin) &&
    item.roe >= numberOrMin(filters.minRoe) &&
    item.aiScore >= numberOrMin(filters.minAiScore) &&
    (item.volume ?? 0) >= numberOrMin(filters.minVolume) &&
    (!filters.industry || filters.industry === "全部" || item.industry === filters.industry)
  );
}

function getMatchReasons(item: ScreenerResultItem, filters: ScreenerFilters) {
  const reasons: string[] = [];
  if (filters.minAiScore !== undefined) reasons.push(`AI Score ${item.aiScore} 高于最低分 ${filters.minAiScore}`);
  if (filters.minRevenueGrowth !== undefined) reasons.push(`营收增长率 ${formatPercent(item.revenueGrowth)} 达标`);
  if (filters.maxPe !== undefined && item.pe !== null) reasons.push(`PE ${formatNumber(item.pe)} 低于上限 ${filters.maxPe}`);
  if (filters.minGrossMargin !== undefined) reasons.push(`毛利率 ${formatPercent(item.grossMargin)} 达标`);
  if (filters.minNetMargin !== undefined) reasons.push(`净利率 ${formatPercent(item.netMargin)} 达标`);
  if (filters.minRoe !== undefined) reasons.push(`ROE ${formatPercent(item.roe)} 达标`);
  if (filters.minMarketCap !== undefined && item.marketCap !== null) reasons.push(`市值 ${formatMarketCap(item.marketCap)} 达标`);
  if (filters.industry && filters.industry !== "全部") reasons.push(`行业匹配：${item.industry}`);
  return reasons.length ? reasons : ["符合当前筛选条件，按 AI Score 排序。"];
}

function hasNonRealData(results: ScreenerResultItem[]) {
  return results.some((item) => item.dataSource !== "真实数据");
}

function isInRange(value: number | null, min?: number, max?: number) {
  if (min === undefined && max === undefined) return true;
  if (value === null) return false;
  if (min !== undefined && value < min) return false;
  if (max !== undefined && value > max) return false;
  return true;
}

function numberOrMin(value?: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : Number.NEGATIVE_INFINITY;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatMarketCap(value: number) {
  if (value >= 1_000_000_000_000) return `${formatNumber(value / 1_000_000_000_000)}T`;
  if (value >= 1_000_000_000) return `${formatNumber(value / 1_000_000_000)}B`;
  return `${formatNumber(value / 1_000_000)}M`;
}
