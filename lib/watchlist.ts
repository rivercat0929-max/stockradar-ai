import { lookupStock } from "@/lib/market-data";
import { getStockDecision, type ResearchJudgment, type StockDecision, type StockDecisionStatus } from "@/lib/stock-decision";

export const defaultWatchlistUser = {
  email: "local@stockradar.ai",
  name: "Local User"
};

export const watchlistGroups = ["重点观察", "等待回调", "财报前观察", "长期关注", "已放弃"] as const;
export const watchlistStatuses = ["high_priority", "wait_for_pullback", "earnings_watch", "long_term_watch", "buy_zone", "abandoned", "insufficient_data"] as const;

export type WatchlistGroup = (typeof watchlistGroups)[number];
export type WatchlistStatus = (typeof watchlistStatuses)[number];

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
  watchlistStatus: WatchlistStatus;
  currentPrice: number | null;
  changePercent: number | null;
  researchJudgment: ResearchJudgment;
  actionStatus: StockDecisionStatus;
  dataCoverage: number;
  confidence: StockDecision["confidence"];
  recentEarningsDate: string | null;
  buyZoneLow: number | null;
  buyZoneHigh: number | null;
  firstWatchPrice: number | null;
  riskReferencePrice: number | null;
  maxPositionWeight: number | null;
  distanceToBuyZonePercent: number | null;
  distanceToBuyZoneLabel: string | null;
  isNearBuyZone: boolean;
  supportingReasons: string[];
  riskReasons: string[];
  dataUpdatedAt: string | null;
  dataSourceLabel: string;
  rawMarketDataSource: string | null;
  decision: StockDecision;
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
  return Promise.all(items.map(enrichWatchlistItem));
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

async function enrichWatchlistItem(item: WatchlistRecord): Promise<EnrichedWatchlistItem> {
  const ticker = item.ticker.trim().toUpperCase();
  try {
    const decision = await getStockDecision(ticker);
    const buyZoneLow = decision.plan.buyZoneLow ?? item.targetBuyPrice ?? null;
    const buyZoneHigh = decision.plan.buyZoneHigh ?? item.targetBuyPrice ?? null;
    const distance = getBuyZoneDistance(decision.currentPrice, buyZoneLow, buyZoneHigh);
    const earningsDate = decision.events.find((event) => event.type === "earnings")?.startAt ?? null;

    return {
      ...item,
      ticker,
          watchlistStatus: deriveWatchlistStatus(item, decision, distance.inZone, Boolean(earningsDate)),
      currentPrice: decision.currentPrice,
      changePercent: decision.quote?.changePercent ?? null,
      researchJudgment: decision.researchJudgment,
      actionStatus: decision.actionStatus,
      dataCoverage: decision.dataCoverage,
      confidence: decision.confidence,
      recentEarningsDate: earningsDate,
      buyZoneLow,
      buyZoneHigh,
      firstWatchPrice: decision.plan.addPrice1,
      riskReferencePrice: decision.plan.riskControlPrice ?? decision.systemReference.riskControlPrice,
      maxPositionWeight: decision.plan.maxPositionWeight,
      distanceToBuyZonePercent: distance.percent,
      distanceToBuyZoneLabel: distance.label,
      isNearBuyZone: distance.isNear,
      supportingReasons: decision.supportingReasons,
      riskReasons: decision.riskReasons,
      dataUpdatedAt: decision.dataUpdatedAt,
      dataSourceLabel: getDecisionSourceLabel(decision),
      rawMarketDataSource: decision.quote?.source ?? null,
      decision
    };
  } catch {
    return unavailableItem(item, ticker);
  }
}

function deriveWatchlistStatus(item: WatchlistRecord, decision: StockDecision, isInBuyZone: boolean, hasEarnings: boolean): WatchlistStatus {
  if (item.group === "已放弃") return "abandoned";
  if (decision.actionStatus === "insufficient_data" || decision.researchJudgment === "insufficient_data") return "insufficient_data";
  if (decision.actionStatus === "buy_in_batches" || isInBuyZone) return "buy_zone";
  if (hasEarnings || item.group === "财报前观察") return "earnings_watch";
  if (decision.actionStatus === "wait_for_pullback" || item.group === "等待回调") return "wait_for_pullback";
  if (item.group === "长期关注") return "long_term_watch";
  return "high_priority";
}

function getBuyZoneDistance(price: number | null, low: number | null, high: number | null) {
  if (price === null || (low === null && high === null)) return { percent: null, label: null, isNear: false, inZone: false };
  if (low !== null && high !== null && price >= low && price <= high) return { percent: 0, label: "已进入买入区", isNear: true, inZone: true };
  const target = price < (low ?? high ?? price) ? low ?? high : high ?? low;
  if (!target || target <= 0) return { percent: null, label: null, isNear: false, inZone: false };
  const percent = Math.abs((price - target) / target) * 100;
  return { percent, label: `距离买入区 ${percent.toFixed(1)}%`, isNear: percent <= 3, inZone: false };
}

function getDecisionSourceLabel(decision: StockDecision) {
  const source = decision.quote?.source;
  if (source === "fmp") return "真实数据 · FMP";
  if (source === "yahoo") return "真实数据 · Yahoo";
  if (source === "cache") return "缓存数据";
  if (source === "stale-cache") return "过期缓存";
  return "暂无可靠数据";
}

function unavailableItem(item: WatchlistRecord, ticker: string): EnrichedWatchlistItem {
  const decision = unavailableDecision(ticker);
  return {
    ...item,
    ticker,
    watchlistStatus: "insufficient_data",
    currentPrice: null,
    changePercent: null,
    researchJudgment: "insufficient_data",
    actionStatus: "insufficient_data",
    dataCoverage: 0,
    confidence: "insufficient",
    recentEarningsDate: null,
    buyZoneLow: item.targetBuyPrice ?? null,
    buyZoneHigh: item.targetBuyPrice ?? null,
    firstWatchPrice: null,
    riskReferencePrice: null,
    maxPositionWeight: null,
    distanceToBuyZonePercent: null,
    distanceToBuyZoneLabel: null,
    isNearBuyZone: false,
    supportingReasons: ["数据不足，暂不生成买入结论。"],
    riskReasons: ["行情或分析数据暂时不可用。"],
    dataUpdatedAt: null,
    dataSourceLabel: "暂无可靠数据",
    rawMarketDataSource: null,
    decision
  };
}

function unavailableDecision(symbol: string): StockDecision {
  return {
    symbol,
    status: "insufficient_data",
    actionStatus: "insufficient_data",
    researchJudgment: "insufficient_data",
    headline: "数据不足",
    summary: "数据不足，暂不生成买入结论。",
    currentPrice: null,
    averageCost: null,
    returnPercent: null,
    positionWeight: null,
    positionWeightCoverage: 0,
    supportingReasons: ["数据不足，暂不生成买入结论。"],
    riskReasons: ["行情或分析数据暂时不可用。"],
    plan: { buyZoneLow: null, buyZoneHigh: null, addPrice1: null, addPrice2: null, riskControlPrice: null, targetPrice1: null, targetPrice2: null, maxPositionWeight: null },
    thesis: null,
    invalidationConditions: [],
    dataCoverage: 0,
    confidence: "insufficient",
    dataUpdatedAt: null,
    warnings: ["数据不足"],
    planCompleteness: { completed: 0, total: 7 },
    systemReference: { buyZoneLow: null, buyZoneHigh: null, supportPrice: null, resistancePrice: null, riskControlPrice: null, targetPrice1: null, targetPrice2: null, notes: [] },
    events: [],
    assetType: "unknown",
    quote: null
  };
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
