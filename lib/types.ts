export type WatchStatus = "持仓" | "观察" | "准备买入" | "准备卖出";
export type AlertPriority = "P0" | "P1" | "P2" | "P3";
export type AlertType = "earnings" | "dividend" | "macro" | "technical" | "valuation" | "risk" | "filing";

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface Watchlist {
  id: string;
  userId: string;
  ticker: string;
  companyName: string;
  market: string;
  status: WatchStatus;
  group?: "é‡ç‚¹è§‚å¯Ÿ" | "ç­‰å¾…å›žè°ƒ" | "è´¢æŠ¥å‰è§‚å¯Ÿ" | "é•¿æœŸå…³æ³¨" | "å·²æ”¾å¼ƒ";
  targetBuyPrice?: number | null;
  targetSellPrice?: number | null;
  watchReason?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt?: string | Date;
}

export interface PortfolioAccount {
  id: string;
  name: string;
  broker?: string | null;
  accountType?: string | null;
  currency: string;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface Holding {
  id: string;
  accountId?: string;
  account?: PortfolioAccount;
  ticker: string;
  companyName?: string | null;
  shares: number;
  averageCost: number;
  targetAllocation?: number | null;
  notes?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  userId?: string;
  currentPrice?: number | null;
  riskStatus?: string;
  marketValue?: number | null;
  totalCost?: number;
  unrealizedPL?: number | null;
  unrealizedPLPercent?: number | null;
  allocation?: number;
  marketDataSource?: "fmp" | "fmp-stable" | "yahoo" | "cache" | "stale-cache" | "mock" | "unavailable";
}

export interface StockScore {
  id: string;
  ticker: string;
  totalScore: number;
  fundamentalScore: number;
  valuationScore: number;
  technicalScore: number;
  catalystScore: number;
  macroScore: number;
  riskScore: number;
  scoreDate: string;
}

export interface StockProfile {
  ticker: string;
  companyName: string;
  market: string;
  status: string;
  recommendation: string;
  conclusion: string;
  buyZone: string;
  sellZone: string;
  invalidPoint: string;
  analysis: string;
  score: StockScore;
}

export interface Alert {
  id: string;
  userId: string;
  ticker?: string;
  alertType: AlertType;
  priority: AlertPriority;
  title: string;
  content: string;
  status: "open" | "resolved";
  createdAt: string;
}

export interface EventItem {
  id: string;
  date: string;
  type: string;
  ticker?: string;
  title: string;
  expectedImpact: string;
  priority: AlertPriority;
}

export interface BacktestResult {
  id: string;
  ticker: string;
  signalType: string;
  sampleSize: number;
  winRate5d: number;
  winRate20d: number;
  winRate60d: number;
  avgReturn20d: number;
  maxDrawdown: number;
  profitLossRatio: number;
  signalGrade: string;
  createdAt: string;
}

export interface DailyBriefing {
  market: string[];
  portfolioRisk: string[];
  opportunities: string[];
  risks: string[];
  upcomingEvents: string[];
}


