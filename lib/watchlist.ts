import { getAiScore, type AiScoreDataSource } from "@/lib/ai-score";
import { getQuote, lookupStock, type MarketDataSource } from "@/lib/market-data";

export const defaultWatchlistUser = {
  email: "local@stockradar.ai",
  name: "Local User"
};

export const watchlistGroups = ["重点观察", "等待回调", "财报前观察", "长期关注", "已放弃"] as const;

export type WatchlistGroup = (typeof watchlistGroups)[number];
export type WatchlistDataQuality = "真实数据" | "缓存数据" | "估算数据" | "示例数据";

export type WatchlistInput = {
  ticker: string;
  companyName?: string | null;
  market?: string | null;
  group?: WatchlistGroup | null;
  targetBuyPrice?: number | null;
  targetSellPrice?: number | null;
  watchReason?: string | null;
  notes?: string | null;
};

export type WatchlistRecord = WatchlistInput & {
  id: string;
  userId: string;
  companyName: string;
  market: string;
  status: string;
  group: WatchlistGroup;
  createdAt: Date | string;
  updatedAt?: Date | string;
};

export type NormalizedWatchlistInput = Omit<WatchlistInput, "ticker" | "companyName" | "market" | "group"> & {
  ticker: string;
  companyName: string;
  market: string;
  group: WatchlistGroup;
};

export type EnrichedWatchlistItem = WatchlistRecord & {
  currentPrice: number | null;
  changePercent: number | null;
  aiScore: number | null;
  rating: string | null;
  ratingLabel: string | null;
  recentEarningsDate: string | null;
  hasRecentAlert: boolean;
  alertLabel: string | null;
  targetDistanceLabel: string | null;
  isNearTarget: boolean;
  priceDataSource: WatchlistDataQuality;
  scoreDataSource: WatchlistDataQuality;
  eventDataSource: WatchlistDataQuality;
  rawMarketDataSource: MarketDataSource | null;
};

export function parseWatchlistInput(body: unknown): { data?: WatchlistInput; error?: string } {
  if (!body || typeof body !== "object") return { error: "请求内容无效。" };
  const record = body as Record<string, unknown>;
  const ticker = getOptionalText(record.ticker)?.toUpperCase();
  if (!ticker) return { error: "股票代码必填。" };

  const targetBuyPrice = getOptionalNumber(record.targetBuyPrice);
  const targetSellPrice = getOptionalNumber(record.targetSellPrice);
  if (targetBuyPrice !== null && targetBuyPrice < 0) return { error: "目标买入价不能小于 0。" };
  if (targetSellPrice !== null && targetSellPrice < 0) return { error: "目标卖出价不能小于 0。" };

  return {
    data: {
      ticker,
      companyName: getOptionalText(record.companyName),
      market: getOptionalText(record.market) ?? "US",
      group: parseGroup(record.group),
      targetBuyPrice,
      targetSellPrice,
      watchReason: getOptionalText(record.watchReason),
      notes: getOptionalText(record.notes)
    }
  };
}

export async function normalizeWatchlistInput(input: WatchlistInput): Promise<NormalizedWatchlistInput> {
  const ticker = input.ticker.trim().toUpperCase();
  let companyName = input.companyName?.trim() || "";

  if (!companyName) {
    try {
      const lookup = await lookupStock(ticker);
      companyName = lookup.companyName || ticker;
    } catch {
      companyName = ticker;
    }
  }

  return {
    ...input,
    ticker,
    companyName,
    market: input.market?.trim() || "US",
    group: input.group && watchlistGroups.includes(input.group) ? input.group : "重点观察"
  };
}

export async function enrichWatchlistItems(items: WatchlistRecord[]): Promise<EnrichedWatchlistItem[]> {
  const enriched = await Promise.all(
    items.map(async (item): Promise<EnrichedWatchlistItem> => {
      const ticker = item.ticker.trim().toUpperCase();
      try {
        const [quote, score] = await Promise.all([getQuote(ticker), getAiScore(ticker)]);
        const target = getTargetDistance(quote.price, item.targetBuyPrice ?? null, item.targetSellPrice ?? null);
        const alert = getWatchlistAlert({ price: quote.price, changePercent: quote.changesPercentage, score: score.score, target });

        return {
          ...item,
          ticker,
          currentPrice: quote.price,
          changePercent: quote.changesPercentage,
          aiScore: score.score,
          rating: score.rating,
          ratingLabel: score.ratingLabel,
          recentEarningsDate: getEstimatedEarningsDate(ticker),
          hasRecentAlert: alert.hasAlert,
          alertLabel: alert.label,
          targetDistanceLabel: target.label,
          isNearTarget: target.isNear,
          priceDataSource: mapMarketSource(quote.marketDataSource, quote.stale),
          scoreDataSource: mapAiSource(score.dataSource),
          eventDataSource: "示例数据",
          rawMarketDataSource: quote.marketDataSource
        };
      } catch {
        return {
          ...item,
          ticker,
          currentPrice: null,
          changePercent: null,
          aiScore: null,
          rating: null,
          ratingLabel: null,
          recentEarningsDate: getEstimatedEarningsDate(ticker),
          hasRecentAlert: false,
          alertLabel: null,
          targetDistanceLabel: null,
          isNearTarget: false,
          priceDataSource: "示例数据",
          scoreDataSource: "示例数据",
          eventDataSource: "示例数据",
          rawMarketDataSource: null
        };
      }
    })
  );

  return enriched;
}

export function toHoldingLikeWatchlistItems(items: WatchlistRecord[]) {
  return items.map((item) => ({
    id: `watchlist-${item.id}`,
    ticker: item.ticker,
    companyName: item.companyName,
    shares: 0,
    averageCost: item.targetBuyPrice ?? 0,
    notes: item.notes ?? item.watchReason ?? null,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt ?? item.createdAt,
    account: {
      id: "watchlist",
      name: "自选股",
      currency: "USD",
      createdAt: item.createdAt,
      updatedAt: item.updatedAt ?? item.createdAt
    }
  }));
}

function parseGroup(value: unknown): WatchlistGroup {
  return typeof value === "string" && watchlistGroups.includes(value as WatchlistGroup) ? (value as WatchlistGroup) : "重点观察";
}

function getOptionalText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getOptionalNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function mapMarketSource(source: MarketDataSource, stale?: boolean): WatchlistDataQuality {
  if (stale) return "缓存数据";
  if (source === "fmp-stable") return "真实数据";
  if (source === "yahoo") return "缓存数据";
  return "示例数据";
}

function mapAiSource(source: AiScoreDataSource): WatchlistDataQuality {
  if (source === "真实数据") return "真实数据";
  if (source === "缓存数据") return "缓存数据";
  if (source === "估算数据") return "估算数据";
  return "示例数据";
}

function getTargetDistance(price: number, buyTarget: number | null, sellTarget: number | null) {
  const candidates = [
    buyTarget ? { type: "买入价", target: buyTarget, distance: Math.abs(price - buyTarget) / buyTarget } : null,
    sellTarget ? { type: "卖出价", target: sellTarget, distance: Math.abs(price - sellTarget) / sellTarget } : null
  ].filter(Boolean) as Array<{ type: string; target: number; distance: number }>;

  const nearest = candidates.sort((a, b) => a.distance - b.distance)[0];
  if (!nearest) return { isNear: false, label: null };
  const percent = nearest.distance * 100;
  return {
    isNear: percent <= 3,
    label: `距离目标${nearest.type} ${percent.toFixed(1)}%`
  };
}

function getWatchlistAlert({
  price,
  changePercent,
  score,
  target
}: {
  price: number;
  changePercent: number;
  score: number;
  target: { isNear: boolean; label: string | null };
}) {
  if (target.isNear) return { hasAlert: true, label: target.label ?? "接近目标价" };
  if (Math.abs(changePercent) >= 5) return { hasAlert: true, label: `今日波动 ${changePercent.toFixed(1)}%` };
  if (score >= 80) return { hasAlert: true, label: "AI Score 高于 80" };
  if (price <= 0) return { hasAlert: false, label: null };
  return { hasAlert: false, label: null };
}

function getEstimatedEarningsDate(ticker: string) {
  const seed = ticker.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const date = new Date();
  date.setDate(date.getDate() + 7 + (seed % 24));
  return date.toISOString().slice(0, 10);
}
