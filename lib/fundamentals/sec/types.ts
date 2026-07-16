export type DataStatus = "real" | "calculated" | "cache" | "stale-cache" | "estimated" | "mock" | "unavailable";
export type Confidence = "high" | "medium" | "low" | "insufficient";

export interface FundamentalPeriod {
  fiscalYear: number | null;
  fiscalQuarter: string | null;
  periodStart: string | null;
  periodEnd: string;
  filedAt: string | null;
  form: string;
  accessionNumber: string | null;
  revenue: number | null;
  netIncome: number | null;
  epsDiluted: number | null;
  operatingCashFlow: number | null;
  capitalExpenditure: number | null;
  freeCashFlow: number | null;
  grossProfit: number | null;
  operatingIncome: number | null;
  assets: number | null;
  liabilities: number | null;
  equity: number | null;
  cash: number | null;
  sharesOutstanding: number | null;
  conceptsUsed: Record<string, string | null>;
  calculatedFields: string[];
}

export interface FundamentalMetric {
  value: number | null;
  source: DataStatus;
  periodsUsed: string[];
  confidence: Confidence;
  missingReason: string | null;
  formula?: string;
}

export interface NormalizedFundamentals {
  symbol: string;
  cik: string | null;
  companyName: string | null;
  status: DataStatus;
  source: string;
  updatedAt: string | null;
  annual: FundamentalPeriod[];
  quarterly: FundamentalPeriod[];
  warnings: string[];
}

export type SecCompanyFactsResponse = {
  cik?: number;
  entityName?: string;
  facts?: {
    "us-gaap"?: Record<string, {
      label?: string;
      units?: Record<string, SecFactUnit[]>;
    }>;
  };
};

export type SecFactUnit = {
  start?: string;
  end?: string;
  val?: number;
  accn?: string;
  fy?: number;
  fp?: string;
  form?: string;
  filed?: string;
  frame?: string;
};
