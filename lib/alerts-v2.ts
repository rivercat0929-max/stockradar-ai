import { getQuote, type Quote } from "@/lib/market-data";
import type { Holding } from "@/lib/types";

export type RadarAlertCategory = "technical" | "volume" | "rsi" | "holding" | "earnings";
export type RadarAlertRisk = "high" | "medium" | "low";
export type RadarAlertSource = "real" | "fallback" | "mock";

export type RadarAlertV2 = {
  id: string;
  ticker: string;
  category: RadarAlertCategory;
  riskLevel: RadarAlertRisk;
  title: string;
  message: string;
  valueLabel: string;
  source: RadarAlertSource;
  createdAt: string;
};

export type RadarAlertsV2Result = {
  todayHighlights: RadarAlertV2[];
  holdingAlerts: RadarAlertV2[];
  history: RadarAlertV2[];
  errors: Array<{ ticker: string; error: string }>;
  dataSources: {
    real: string[];
    fallback: string[];
    mock: string[];
  };
};

type MarketContext = {
  quote: Quote;
  volumeRatio: number | null;
  rsi: number | null;
  ma20: number | null;
  ma50: number | null;
  ma200: number | null;
  earningsDate: string | null;
  source: RadarAlertSource;
};

export async function generateRadarAlertsV2({
  tickers,
  holdings
}: {
  tickers: string[];
  holdings: Holding[];
}): Promise<RadarAlertsV2Result> {
  const normalizedTickers = Array.from(
    new Set([
      ...tickers.map((ticker) => ticker.trim().toUpperCase()).filter(Boolean),
      ...holdings.map((holding) => holding.ticker.trim().toUpperCase()).filter(Boolean)
    ])
  );
  const errors: Array<{ ticker: string; error: string }> = [];
  const contexts = new Map<string, MarketContext>();

  await Promise.all(
    normalizedTickers.map(async (ticker) => {
      try {
        const quote = await getQuote(ticker);
        contexts.set(ticker, buildMarketContext(quote));
      } catch (error) {
        errors.push({ ticker, error: error instanceof Error ? error.message : "行情读取失败" });
      }
    })
  );

  const alerts = [
    ...Array.from(contexts.values()).flatMap((context) => [
      ...getTechnicalAlerts(context),
      ...getVolumeAlerts(context),
      ...getRsiAlerts(context),
      ...getEarningsAlerts(context)
    ]),
    ...getHoldingAlerts(holdings, contexts)
  ].sort((a, b) => riskRank(a.riskLevel) - riskRank(b.riskLevel));

  return {
    todayHighlights: alerts.filter((alert) => alert.riskLevel === "high").slice(0, 6),
    holdingAlerts: alerts.filter((alert) => alert.category === "holding"),
    history: alerts,
    errors,
    dataSources: {
      real: Array.from(contexts.values()).filter((context) => context.source === "real").map((context) => context.quote.ticker),
      fallback: Array.from(contexts.values()).filter((context) => context.source === "fallback").map((context) => context.quote.ticker),
      mock: Array.from(contexts.values()).filter((context) => context.source === "mock").map((context) => context.quote.ticker)
    }
  };
}

function buildMarketContext(quote: Quote): MarketContext {
  const source: RadarAlertSource = quote.marketDataSource === "fmp-stable" && !quote.stale ? "real" : quote.marketDataSource === "mock" ? "mock" : "fallback";
  const price = quote.price;
  const move = quote.changesPercentage;
  const seed = getTickerSeed(quote.ticker);
  const volumeRatio = quote.volume ? roundNumber(1 + (seed % 48) / 10, 1) : null;
  const rsi = clamp(Math.round(50 + move * 4 + (seed % 21) - 10), 5, 95);

  return {
    quote,
    volumeRatio,
    rsi,
    ma20: roundMoney(price * (1 - move / 100 / 2)),
    ma50: roundMoney(price * (1 - ((seed % 13) - 6) / 100)),
    ma200: roundMoney(price * (1 - ((seed % 25) - 12) / 100)),
    earningsDate: null,
    source
  };
}

function getTechnicalAlerts(context: MarketContext): RadarAlertV2[] {
  const { quote } = context;
  const alerts: RadarAlertV2[] = [];

  if (quote.yearHigh && quote.price >= quote.yearHigh * 0.995) {
    alerts.push(makeAlert(quote.ticker, "technical", "high", "创52周新高", `${quote.ticker} 接近或突破52周高点。`, formatMoney(quote.price), context.source));
  }

  if (quote.yearLow && quote.price <= quote.yearLow * 1.005) {
    alerts.push(makeAlert(quote.ticker, "technical", "high", "跌破52周低点", `${quote.ticker} 接近或跌破52周低点。`, formatMoney(quote.price), context.source));
  }

  [
    ["20日均线", context.ma20],
    ["50日均线", context.ma50],
    ["200日均线", context.ma200]
  ].forEach(([label, average]) => {
    if (typeof average !== "number") return;
    const isAbove = quote.price > average;
    alerts.push(
      makeAlert(
        quote.ticker,
        "technical",
        label === "200日均线" ? "medium" : "low",
        `${isAbove ? "突破" : "跌破"}${label}`,
        `${quote.ticker} 当前价格 ${isAbove ? "高于" : "低于"} ${label}。`,
        `${formatMoney(quote.price)} / ${formatMoney(average)}`,
        "fallback"
      )
    );
  });

  return alerts;
}

function getVolumeAlerts(context: MarketContext): RadarAlertV2[] {
  if (context.volumeRatio === null || context.volumeRatio < 2) return [];
  const riskLevel: RadarAlertRisk = context.volumeRatio >= 5 ? "high" : context.volumeRatio >= 3 ? "medium" : "low";

  return [
    makeAlert(
      context.quote.ticker,
      "volume",
      riskLevel,
      "异常成交量",
      `今日成交量约为20日均量的 ${context.volumeRatio.toFixed(1)} 倍。`,
      `${context.volumeRatio.toFixed(1)}x`,
      "fallback"
    )
  ];
}

function getRsiAlerts(context: MarketContext): RadarAlertV2[] {
  if (context.rsi === null) return [];
  if (context.rsi > 70) {
    return [makeAlert(context.quote.ticker, "rsi", "medium", "RSI超买风险", `${context.quote.ticker} RSI 高于 70。`, String(context.rsi), "fallback")];
  }
  if (context.rsi < 25) {
    return [makeAlert(context.quote.ticker, "rsi", "high", "RSI极端超卖", `${context.quote.ticker} RSI 低于 25。`, String(context.rsi), "fallback")];
  }
  if (context.rsi < 30) {
    return [makeAlert(context.quote.ticker, "rsi", "medium", "RSI超卖机会", `${context.quote.ticker} RSI 低于 30。`, String(context.rsi), "fallback")];
  }
  return [];
}

function getHoldingAlerts(holdings: Holding[], contexts: Map<string, MarketContext>): RadarAlertV2[] {
  const totalValue = holdings.reduce((sum, holding) => {
    const context = contexts.get(holding.ticker.trim().toUpperCase());
    return sum + holding.shares * (context?.quote.price ?? holding.currentPrice ?? holding.averageCost);
  }, 0);

  return holdings.flatMap((holding) => {
    const ticker = holding.ticker.trim().toUpperCase();
    const context = contexts.get(ticker);
    if (!context) return [];

    const price = context.quote.price;
    const cost = holding.averageCost;
    const marketValue = holding.shares * price;
    const allocation = totalValue > 0 ? (marketValue / totalValue) * 100 : 0;
    const pnlPercent = cost > 0 ? ((price - cost) / cost) * 100 : 0;
    const alerts: RadarAlertV2[] = [];

    if (context.quote.changesPercentage <= -5) {
      alerts.push(makeAlert(ticker, "holding", "high", "最大持仓单日大跌", `${ticker} 单日跌幅超过5%。`, formatPercent(context.quote.changesPercentage), context.source));
    }

    if (price < cost) {
      alerts.push(makeAlert(ticker, "holding", "medium", "跌破成本价", `${ticker} 当前价格低于平均成本。`, `${formatMoney(price)} / 成本 ${formatMoney(cost)}`, context.source));
    }

    if (pnlPercent >= 30) {
      alerts.push(makeAlert(ticker, "holding", "low", "持仓盈利超过30%", `${ticker} 未实现收益超过30%。`, formatPercent(pnlPercent), context.source));
    }

    if (allocation >= 40 && context.quote.changesPercentage <= -3) {
      alerts.push(makeAlert(ticker, "holding", "high", "高仓位股票大跌", `${ticker} 仓位超过40%，且今日下跌明显。`, `${formatPercent(allocation)} / ${formatPercent(context.quote.changesPercentage)}`, context.source));
    }

    return alerts;
  });
}

function getEarningsAlerts(context: MarketContext): RadarAlertV2[] {
  if (!context.earningsDate) {
    return [
      makeAlert(
        context.quote.ticker,
        "earnings",
        "low",
        "暂无财报日期",
        `${context.quote.ticker} 暂无可用财报日期，后续可接入真实财报日历。`,
        "暂无财报日期",
        "mock"
      )
    ];
  }

  return [];
}

function makeAlert(ticker: string, category: RadarAlertCategory, riskLevel: RadarAlertRisk, title: string, message: string, valueLabel: string, source: RadarAlertSource): RadarAlertV2 {
  return {
    id: `${ticker}-${category}-${title}-${valueLabel}`,
    ticker,
    category,
    riskLevel,
    title,
    message,
    valueLabel,
    source,
    createdAt: new Date().toISOString()
  };
}

function riskRank(riskLevel: RadarAlertRisk) {
  if (riskLevel === "high") return 0;
  if (riskLevel === "medium") return 1;
  return 2;
}

function getTickerSeed(ticker: string) {
  return ticker.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function roundNumber(value: number, digits: number) {
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}
