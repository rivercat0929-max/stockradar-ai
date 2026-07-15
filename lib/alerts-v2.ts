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
        if (quote.price === null) {
          errors.push({ ticker, error: "行情暂不可用，已跳过本轮预警检查" });
          return;
        }
        contexts.set(ticker, buildMarketContext(quote));
      } catch (error) {
        errors.push({ ticker, error: error instanceof Error ? error.message : "è¡Œæƒ…è¯»å–å¤±è´¥" });
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
  const source: RadarAlertSource = quote.marketDataSource === "fmp" && !quote.stale ? "real" : quote.marketDataSource === "mock" ? "mock" : "fallback";
  const price = quote.price ?? 0;
  const move = quote.changesPercentage ?? 0;
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
  const price = quote.price ?? 0;
  const alerts: RadarAlertV2[] = [];

  if (quote.yearHigh && price >= quote.yearHigh * 0.995) {
    alerts.push(makeAlert(quote.ticker, "technical", "high", "åˆ›52å‘¨æ–°é«˜", `${quote.ticker} æŽ¥è¿‘æˆ–çªç ´52å‘¨é«˜ç‚¹ã€‚`, formatMoney(price), context.source));
  }

  if (quote.yearLow && price <= quote.yearLow * 1.005) {
    alerts.push(makeAlert(quote.ticker, "technical", "high", "è·Œç ´52å‘¨ä½Žç‚¹", `${quote.ticker} æŽ¥è¿‘æˆ–è·Œç ´52å‘¨ä½Žç‚¹ã€‚`, formatMoney(price), context.source));
  }

  [
    ["20æ—¥å‡çº¿", context.ma20],
    ["50æ—¥å‡çº¿", context.ma50],
    ["200æ—¥å‡çº¿", context.ma200]
  ].forEach(([label, average]) => {
    if (typeof average !== "number") return;
    const isAbove = price > average;
    alerts.push(
      makeAlert(
        quote.ticker,
        "technical",
        label === "200æ—¥å‡çº¿" ? "medium" : "low",
        `${isAbove ? "çªç ´" : "è·Œç ´"}${label}`,
        `${quote.ticker} å½“å‰ä»·æ ¼ ${isAbove ? "é«˜äºŽ" : "ä½ŽäºŽ"} ${label}ã€‚`,
        `${formatMoney(price)} / ${formatMoney(average)}`,
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
      "å¼‚å¸¸æˆäº¤é‡",
      `ä»Šæ—¥æˆäº¤é‡çº¦ä¸º20æ—¥å‡é‡çš„ ${context.volumeRatio.toFixed(1)} å€ã€‚`,
      `${context.volumeRatio.toFixed(1)}x`,
      "fallback"
    )
  ];
}

function getRsiAlerts(context: MarketContext): RadarAlertV2[] {
  if (context.rsi === null) return [];
  if (context.rsi > 70) {
    return [makeAlert(context.quote.ticker, "rsi", "medium", "RSIè¶…ä¹°é£Žé™©", `${context.quote.ticker} RSI é«˜äºŽ 70ã€‚`, String(context.rsi), "fallback")];
  }
  if (context.rsi < 25) {
    return [makeAlert(context.quote.ticker, "rsi", "high", "RSIæžç«¯è¶…å–", `${context.quote.ticker} RSI ä½ŽäºŽ 25ã€‚`, String(context.rsi), "fallback")];
  }
  if (context.rsi < 30) {
    return [makeAlert(context.quote.ticker, "rsi", "medium", "RSIè¶…å–æœºä¼š", `${context.quote.ticker} RSI ä½ŽäºŽ 30ã€‚`, String(context.rsi), "fallback")];
  }
  return [];
}

function getHoldingAlerts(holdings: Holding[], contexts: Map<string, MarketContext>): RadarAlertV2[] {
  const totalValue = holdings.reduce((sum, holding) => {
    const context = contexts.get(holding.ticker.trim().toUpperCase());
    return sum + holding.shares * (context?.quote.price ?? holding.currentPrice ?? 0);
  }, 0);

  return holdings.flatMap((holding) => {
    const ticker = holding.ticker.trim().toUpperCase();
    const context = contexts.get(ticker);
    if (!context) return [];

    const price = context.quote.price ?? 0;
    const cost = holding.averageCost;
    const marketValue = holding.shares * price;
    const allocation = totalValue > 0 ? (marketValue / totalValue) * 100 : 0;
    const pnlPercent = cost > 0 ? ((price - cost) / cost) * 100 : 0;
    const alerts: RadarAlertV2[] = [];

    if ((context.quote.changesPercentage ?? 0) <= -5) {
      alerts.push(makeAlert(ticker, "holding", "high", "æœ€å¤§æŒä»“å•æ—¥å¤§è·Œ", `${ticker} å•æ—¥è·Œå¹…è¶…è¿‡5%ã€‚`, formatPercent(context.quote.changesPercentage ?? 0), context.source));
    }

    if (price < cost) {
      alerts.push(makeAlert(ticker, "holding", "medium", "è·Œç ´æˆæœ¬ä»·", `${ticker} å½“å‰ä»·æ ¼ä½ŽäºŽå¹³å‡æˆæœ¬ã€‚`, `${formatMoney(price)} / æˆæœ¬ ${formatMoney(cost)}`, context.source));
    }

    if (pnlPercent >= 30) {
      alerts.push(makeAlert(ticker, "holding", "low", "æŒä»“ç›ˆåˆ©è¶…è¿‡30%", `${ticker} æœªå®žçŽ°æ”¶ç›Šè¶…è¿‡30%ã€‚`, formatPercent(pnlPercent), context.source));
    }

    if (allocation >= 40 && (context.quote.changesPercentage ?? 0) <= -3) {
      alerts.push(makeAlert(ticker, "holding", "high", "é«˜ä»“ä½è‚¡ç¥¨å¤§è·Œ", `${ticker} ä»“ä½è¶…è¿‡40%ï¼Œä¸”ä»Šæ—¥ä¸‹è·Œæ˜Žæ˜¾ã€‚`, `${formatPercent(allocation)} / ${formatPercent(context.quote.changesPercentage ?? 0)}`, context.source));
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
        "æš‚æ— è´¢æŠ¥æ—¥æœŸ",
        `${context.quote.ticker} æš‚æ— å¯ç”¨è´¢æŠ¥æ—¥æœŸï¼ŒåŽç»­å¯æŽ¥å…¥çœŸå®žè´¢æŠ¥æ—¥åŽ†ã€‚`,
        "æš‚æ— è´¢æŠ¥æ—¥æœŸ",
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



