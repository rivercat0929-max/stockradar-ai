import { getCache, getStaleCache, setCache } from "@/lib/cache";
import { getAiScore } from "@/lib/ai-score";

export type BuyRule = "ai_score_gt_80" | "break_above_ma20" | "break_above_ma50" | "rsi_below_30";
export type SellRule = "break_below_ma20" | "break_below_ma50" | "stop_loss_10" | "take_profit_30";
export type BacktestDataSource = "Yahoo真实历史价格" | "FMP真实历史价格" | "本地缓存历史价格";

export type BacktestInput = {
  ticker: string;
  startDate: string;
  endDate: string;
  initialCapital: number;
  buyRules: BuyRule[];
  sellRules: SellRule[];
};

export type BacktestPoint = {
  date: string;
  close: number;
  equity: number;
  drawdown: number;
  ma20: number | null;
  ma50: number | null;
  rsi: number | null;
  marker?: "buy" | "sell";
};

export type BacktestTrade = {
  entryDate: string;
  exitDate: string;
  entryPrice: number;
  exitPrice: number;
  shares: number;
  returnPercent: number;
  exitReason: string;
};

export type BacktestResultV1 = {
  ticker: string;
  startDate: string;
  endDate: string;
  initialCapital: number;
  finalEquity: number;
  totalReturn: number;
  annualizedReturn: number;
  maxDrawdown: number;
  winRate: number;
  tradeCount: number;
  strategyEvaluation: string;
  aiScoreUsed: number | null;
  aiScoreNotice: string;
  dataSource: BacktestDataSource;
  equityCurve: BacktestPoint[];
  trades: BacktestTrade[];
  warnings: string[];
};

type PriceBar = {
  date: string;
  close: number;
};

const historyCacheTtlMs = 60 * 60 * 1000;

export async function runBacktest(input: BacktestInput): Promise<BacktestResultV1> {
  validateBacktestInput(input);
  const ticker = input.ticker.trim().toUpperCase();
  const [historyResult, aiScoreResult] = await Promise.all([
    getHistoricalPrices(ticker, input.startDate, input.endDate),
    getAiScore(ticker).catch(() => null)
  ]);

  if (historyResult.prices.length < 60) {
    throw new Error("历史数据暂不可用，无法生成足够的日线样本。");
  }

  const enriched = addIndicators(historyResult.prices);
  const aiScore = aiScoreResult?.score ?? null;
  let cash = input.initialCapital;
  let shares = 0;
  let entryPrice = 0;
  let entryDate = "";
  let peakEquity = input.initialCapital;
  const equityCurve: BacktestPoint[] = [];
  const trades: BacktestTrade[] = [];

  enriched.forEach((bar, index) => {
    const previous = index > 0 ? enriched[index - 1] : null;
    let marker: "buy" | "sell" | undefined;

    if (shares > 0) {
      const sellReason = getSellReason({ bar, previous, entryPrice, sellRules: input.sellRules });
      if (sellReason) {
        cash = shares * bar.close;
        const returnPercent = ((bar.close - entryPrice) / entryPrice) * 100;
        trades.push({
          entryDate,
          exitDate: bar.date,
          entryPrice,
          exitPrice: bar.close,
          shares,
          returnPercent: roundPercent(returnPercent),
          exitReason: sellReason
        });
        shares = 0;
        entryPrice = 0;
        entryDate = "";
        marker = "sell";
      }
    }

    if (shares === 0 && shouldBuy({ bar, previous, buyRules: input.buyRules, aiScore })) {
      shares = cash / bar.close;
      cash = 0;
      entryPrice = bar.close;
      entryDate = bar.date;
      marker = "buy";
    }

    const equity = shares > 0 ? shares * bar.close : cash;
    peakEquity = Math.max(peakEquity, equity);
    const drawdown = peakEquity > 0 ? ((equity - peakEquity) / peakEquity) * 100 : 0;
    equityCurve.push({
      date: bar.date,
      close: bar.close,
      equity: roundMoney(equity),
      drawdown: roundPercent(drawdown),
      ma20: bar.ma20,
      ma50: bar.ma50,
      rsi: bar.rsi,
      marker
    });
  });

  const finalBar = enriched[enriched.length - 1];
  if (shares > 0) {
    const finalEquity = shares * finalBar.close;
    trades.push({
      entryDate,
      exitDate: finalBar.date,
      entryPrice,
      exitPrice: finalBar.close,
      shares,
      returnPercent: roundPercent(((finalBar.close - entryPrice) / entryPrice) * 100),
      exitReason: "回测结束平仓"
    });
    equityCurve[equityCurve.length - 1].marker = "sell";
  }

  const finalEquity = equityCurve[equityCurve.length - 1]?.equity ?? input.initialCapital;
  const totalReturn = ((finalEquity - input.initialCapital) / input.initialCapital) * 100;
  const annualizedReturn = getAnnualizedReturn(input.startDate, input.endDate, finalEquity / input.initialCapital);
  const maxDrawdown = Math.min(...equityCurve.map((point) => point.drawdown));
  const closedTrades = trades.filter((trade) => trade.exitReason !== "回测结束平仓" || input.sellRules.length > 0);
  const winRate = closedTrades.length ? (closedTrades.filter((trade) => trade.returnPercent > 0).length / closedTrades.length) * 100 : 0;

  return {
    ticker,
    startDate: input.startDate,
    endDate: input.endDate,
    initialCapital: input.initialCapital,
    finalEquity: roundMoney(finalEquity),
    totalReturn: roundPercent(totalReturn),
    annualizedReturn: roundPercent(annualizedReturn),
    maxDrawdown: roundPercent(maxDrawdown),
    winRate: roundPercent(winRate),
    tradeCount: trades.length,
    strategyEvaluation: getStrategyEvaluation(totalReturn, maxDrawdown, winRate, trades.length),
    aiScoreUsed: aiScore,
    aiScoreNotice: "AI Score历史回测为规则近似，不代表真实历史AI评分。",
    dataSource: historyResult.source,
    equityCurve,
    trades,
    warnings: [
      "回测不代表未来收益。",
      "V1为简化模型，未考虑滑点、税费、汇率、分红。",
      "结果仅供研究参考。"
    ]
  };
}

async function getHistoricalPrices(ticker: string, startDate: string, endDate: string) {
  const cacheKey = `history:${ticker}:${startDate}:${endDate}`;
  const cached = getCache<{ prices: PriceBar[]; source: BacktestDataSource }>(cacheKey);
  if (cached) return cached;
  const stale = getStaleCache<{ prices: PriceBar[]; source: BacktestDataSource }>(cacheKey);

  const yahoo = await getYahooHistoricalPrices(ticker, startDate, endDate);
  if (yahoo.length) {
    const result = { prices: yahoo, source: "Yahoo真实历史价格" as const };
    setCache(cacheKey, result, historyCacheTtlMs);
    return result;
  }

  const fmp = await getFmpHistoricalPrices(ticker, startDate, endDate);
  if (fmp.length) {
    const result = { prices: fmp, source: "FMP真实历史价格" as const };
    setCache(cacheKey, result, historyCacheTtlMs);
    return result;
  }

  if (stale?.prices.length) return { ...stale, source: "本地缓存历史价格" as const };
  throw new Error("历史数据暂不可用");
}

async function getYahooHistoricalPrices(ticker: string, startDate: string, endDate: string) {
  try {
    const period1 = Math.floor(new Date(`${startDate}T00:00:00Z`).getTime() / 1000);
    const period2 = Math.floor(new Date(`${endDate}T23:59:59Z`).getTime() / 1000);
    const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}`);
    url.searchParams.set("period1", String(period1));
    url.searchParams.set("period2", String(period2));
    url.searchParams.set("interval", "1d");
    url.searchParams.set("events", "history");
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return [];
    const data = await response.json();
    const result = data?.chart?.result?.[0];
    const timestamps: number[] = result?.timestamp ?? [];
    const closes: Array<number | null> = result?.indicators?.quote?.[0]?.close ?? [];
    return timestamps
      .map((timestamp, index) => ({ date: new Date(timestamp * 1000).toISOString().slice(0, 10), close: closes[index] }))
      .filter((bar): bar is PriceBar => typeof bar.close === "number" && Number.isFinite(bar.close) && bar.close > 0);
  } catch {
    return [];
  }
}

async function getFmpHistoricalPrices(ticker: string, startDate: string, endDate: string) {
  const apiKey = process.env.FMP_API_KEY;
  if (!apiKey) return [];

  try {
    const url = new URL(`https://financialmodelingprep.com/stable/historical-price-eod/full`);
    url.searchParams.set("symbol", ticker);
    url.searchParams.set("from", startDate);
    url.searchParams.set("to", endDate);
    url.searchParams.set("apikey", apiKey);
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return [];
    const data = await response.json();
    const rows = Array.isArray(data) ? data : Array.isArray(data?.historical) ? data.historical : [];
    return rows
      .map((row: Record<string, unknown>) => ({
        date: typeof row.date === "string" ? row.date : "",
        close: typeof row.close === "number" ? row.close : null
      }))
      .filter((bar: { date: string; close: number | null }): bar is PriceBar => Boolean(bar.date) && typeof bar.close === "number" && bar.close > 0)
      .sort((a: PriceBar, b: PriceBar) => a.date.localeCompare(b.date));
  } catch {
    return [];
  }
}

function addIndicators(prices: PriceBar[]) {
  return prices.map((bar, index) => ({
    ...bar,
    ma20: movingAverage(prices, index, 20),
    ma50: movingAverage(prices, index, 50),
    rsi: calculateRsi(prices, index, 14)
  }));
}

function movingAverage(prices: PriceBar[], index: number, window: number) {
  if (index + 1 < window) return null;
  const slice = prices.slice(index + 1 - window, index + 1);
  return roundMoney(slice.reduce((sum, bar) => sum + bar.close, 0) / window);
}

function calculateRsi(prices: PriceBar[], index: number, period: number) {
  if (index < period) return null;
  let gains = 0;
  let losses = 0;
  for (let i = index - period + 1; i <= index; i += 1) {
    const diff = prices[i].close - prices[i - 1].close;
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }
  if (losses === 0) return 100;
  const rs = gains / losses;
  return roundPercent(100 - 100 / (1 + rs));
}

function shouldBuy({ bar, previous, buyRules, aiScore }: { bar: ReturnType<typeof addIndicators>[number]; previous: ReturnType<typeof addIndicators>[number] | null; buyRules: BuyRule[]; aiScore: number | null }) {
  if (!buyRules.length) return false;
  return buyRules.every((rule) => {
    if (rule === "ai_score_gt_80") return aiScore !== null && aiScore > 80;
    if (rule === "break_above_ma20") return crossedAbove(bar.close, previous?.close, bar.ma20, previous?.ma20);
    if (rule === "break_above_ma50") return crossedAbove(bar.close, previous?.close, bar.ma50, previous?.ma50);
    if (rule === "rsi_below_30") return bar.rsi !== null && bar.rsi < 30;
    return false;
  });
}

function getSellReason({ bar, previous, entryPrice, sellRules }: { bar: ReturnType<typeof addIndicators>[number]; previous: ReturnType<typeof addIndicators>[number] | null; entryPrice: number; sellRules: SellRule[] }) {
  for (const rule of sellRules) {
    if (rule === "break_below_ma20" && crossedBelow(bar.close, previous?.close, bar.ma20, previous?.ma20)) return "跌破20日均线";
    if (rule === "break_below_ma50" && crossedBelow(bar.close, previous?.close, bar.ma50, previous?.ma50)) return "跌破50日均线";
    if (rule === "stop_loss_10" && entryPrice > 0 && (bar.close - entryPrice) / entryPrice <= -0.1) return "止损 -10%";
    if (rule === "take_profit_30" && entryPrice > 0 && (bar.close - entryPrice) / entryPrice >= 0.3) return "止盈 +30%";
  }
  return null;
}

function crossedAbove(price: number, previousPrice: number | undefined, ma: number | null, previousMa: number | null | undefined) {
  return ma !== null && previousPrice !== undefined && previousMa !== null && previousMa !== undefined && previousPrice <= previousMa && price > ma;
}

function crossedBelow(price: number, previousPrice: number | undefined, ma: number | null, previousMa: number | null | undefined) {
  return ma !== null && previousPrice !== undefined && previousMa !== null && previousMa !== undefined && previousPrice >= previousMa && price < ma;
}

function getAnnualizedReturn(startDate: string, endDate: string, returnMultiple: number) {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const days = Math.max(1, (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return (Math.pow(returnMultiple, 365 / days) - 1) * 100;
}

function getStrategyEvaluation(totalReturn: number, maxDrawdown: number, winRate: number, tradeCount: number) {
  if (tradeCount === 0) return "该策略在回测区间内没有触发交易，建议放宽买入条件。";
  if (totalReturn > 20 && maxDrawdown > -20 && winRate >= 50) return "策略表现较好，但仍需扩大样本并考虑交易成本。";
  if (totalReturn > 0 && maxDrawdown > -30) return "策略表现中性偏正，可继续优化卖出规则和风险控制。";
  if (maxDrawdown <= -30) return "策略回撤偏高，不适合直接用于实盘。";
  return "策略表现偏弱，建议重新检查买入条件或市场环境。";
}

function validateBacktestInput(input: BacktestInput) {
  if (!input.ticker.trim()) throw new Error("请输入股票代码。");
  if (!input.startDate || !input.endDate) throw new Error("请输入回测开始和结束日期。");
  if (new Date(input.startDate) >= new Date(input.endDate)) throw new Error("结束日期必须晚于开始日期。");
  if (!Number.isFinite(input.initialCapital) || input.initialCapital <= 0) throw new Error("初始资金必须大于0。");
  if (!input.buyRules.length) throw new Error("请至少选择一个买入规则。");
  if (!input.sellRules.length) throw new Error("请至少选择一个卖出规则。");
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function roundPercent(value: number) {
  return Math.round(value * 100) / 100;
}
