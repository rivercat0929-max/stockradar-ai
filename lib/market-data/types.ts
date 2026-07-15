export type MarketDataSource = "fmp" | "yahoo" | "cache" | "stale-cache" | "mock" | "unavailable";

export interface MarketQuote {
  symbol: string;
  name: string | null;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  previousClose: number | null;
  open: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  volume: number | null;
  marketCap: number | null;
  currency: string | null;
  exchange: string | null;
  source: MarketDataSource;
  originalSource?: "fmp" | "yahoo" | null;
  updatedAt: string | null;
  fetchedAt: string;
  isStale: boolean;
  isMarketOpen?: boolean | null;
  error?: string | null;
}

export type LegacyMarketDataSource = "fmp" | "fmp-stable" | "yahoo" | "cache" | "stale-cache" | "mock" | "unavailable";

export type Quote = MarketQuote & {
  ticker: string;
  changesPercentage: number | null;
  pe?: number | null;
  eps?: number | null;
  yearHigh: number | null;
  yearLow: number | null;
  marketDataSource: LegacyMarketDataSource;
  isFallback: boolean;
  stale?: boolean;
};

export type StockLookup = {
  symbol: string;
  companyName: string;
  price: number | null;
  currency: string;
};
