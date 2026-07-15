export type EventType =
  | "earnings"
  | "dividend"
  | "fomc"
  | "cpi"
  | "ppi"
  | "nonfarm-payrolls"
  | "gdp"
  | "other";

export type EventImportance = "high" | "medium" | "low";

export type EventDateStatus = "confirmed" | "estimated";

export type EventDataSource =
  | "fmp"
  | "nasdaq"
  | "bls"
  | "bea"
  | "federal-reserve"
  | "manual-official"
  | "cache"
  | "stale-cache"
  | "unavailable";

export interface MarketEvent {
  id: string;
  type: EventType;
  title: string;
  description: string | null;
  symbol: string | null;
  companyName: string | null;
  startAt: string;
  endAt: string | null;
  timezone: string | null;
  importance: EventImportance;
  dateStatus: EventDateStatus;
  source: EventDataSource;
  sourceName: string;
  sourceUrl?: string | null;
  updatedAt: string | null;
  fetchedAt: string;
  isStale: boolean;
  previousValue?: string | null;
  forecastValue?: string | null;
  actualValue?: string | null;
}

export type GetMarketEventsOptions = {
  from?: string;
  to?: string;
  symbols?: string[];
  types?: EventType[];
};

export type MarketEventsResult = {
  events: MarketEvent[];
  warnings: string[];
};
