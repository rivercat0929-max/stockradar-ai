export type Quote = {
  ticker: string;
  name: string;
  price: number;
  change: number;
  changesPercentage: number;
  marketCap: number | null;
  volume: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  yearHigh: number | null;
  yearLow: number | null;
  isFallback: boolean;
};

const fallbackPrices: Record<string, number> = {
  TSLA: 320,
  AMZN: 220,
  NVDA: 175,
  CEG: 300,
  MSFT: 430,
  GOOGL: 180,
  META: 500,
  AAPL: 210
};

export async function getQuote(ticker: string): Promise<Quote> {
  const normalizedTicker = ticker.trim().toUpperCase();
  const apiKey = process.env.FMP_API_KEY;

  if (!apiKey) {
    return fallbackQuote(normalizedTicker);
  }

  try {
    const response = await fetch(
      `https://financialmodelingprep.com/api/v3/quote/${encodeURIComponent(normalizedTicker)}?apikey=${encodeURIComponent(apiKey)}`,
      { cache: "no-store" }
    );

    if (!response.ok) {
      return fallbackQuote(normalizedTicker);
    }

    const data = await response.json();
    const quote = Array.isArray(data) ? data[0] : null;

    if (!quote || typeof quote.price !== "number") {
      return fallbackQuote(normalizedTicker);
    }

    return {
      ticker: String(quote.symbol ?? normalizedTicker).toUpperCase(),
      name: String(quote.name ?? normalizedTicker),
      price: Number(quote.price),
      change: numberOrZero(quote.change),
      changesPercentage: numberOrZero(quote.changesPercentage),
      marketCap: nullableNumber(quote.marketCap),
      volume: nullableNumber(quote.volume),
      dayHigh: nullableNumber(quote.dayHigh),
      dayLow: nullableNumber(quote.dayLow),
      yearHigh: nullableNumber(quote.yearHigh),
      yearLow: nullableNumber(quote.yearLow),
      isFallback: false
    };
  } catch {
    return fallbackQuote(normalizedTicker);
  }
}

function fallbackQuote(ticker: string): Quote {
  const price = fallbackPrices[ticker] ?? 0;

  return {
    ticker,
    name: ticker,
    price,
    change: 0,
    changesPercentage: 0,
    marketCap: null,
    volume: null,
    dayHigh: null,
    dayLow: null,
    yearHigh: null,
    yearLow: null,
    isFallback: true
  };
}

function nullableNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function numberOrZero(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
