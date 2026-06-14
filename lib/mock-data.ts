import { buildScore } from "@/lib/scoring";
import type { Alert, BacktestResult, DailyBriefing, EventItem, Holding, StockProfile, User, Watchlist } from "@/lib/types";

export const user: User = {
  id: "user-demo",
  email: "demo@stockradar.ai",
  name: "Demo Investor",
  createdAt: "2026-06-13T00:00:00.000Z"
};

export const stocks: StockProfile[] = [
  {
    ticker: "TSLA",
    companyName: "Tesla",
    market: "NASDAQ",
    status: "高波动",
    recommendation: "降低单股仓位，等待支撑确认",
    conclusion: "继续观察，波动较高。",
    buyZone: "$165 - $178",
    sellZone: "$225 以上分批减仓",
    invalidPoint: "跌破 $158",
    analysis: "交付和毛利率仍是关键变量，技术面接近支撑但波动显著。",
    score: buildScore("TSLA", { fundamentalScore: 72, valuationScore: 58, technicalScore: 68, catalystScore: 74, macroScore: 62, riskScore: 45 })
  },
  {
    ticker: "AMZN",
    companyName: "Amazon",
    market: "NASDAQ",
    status: "等回调",
    recommendation: "B+，等待回调买入",
    conclusion: "继续持有，等待回调加仓。",
    buyZone: "$178 - $188",
    sellZone: "$220 以上估值偏高",
    invalidPoint: "跌破 $168",
    analysis: "AWS 和广告业务是主要驱动力，基本面稳定，当前不适合追高。",
    score: buildScore("AMZN", { fundamentalScore: 86, valuationScore: 76, technicalScore: 80, catalystScore: 82, macroScore: 74, riskScore: 72 })
  },
  {
    ticker: "NVDA",
    companyName: "NVIDIA",
    market: "NASDAQ",
    status: "估值高",
    recommendation: "基本面强，等待财报确认",
    conclusion: "强势持有，控制追高风险。",
    buyZone: "$118 - $126",
    sellZone: "$155 以上考虑减仓",
    invalidPoint: "跌破 $110",
    analysis: "AI 需求维持强劲，估值已经反映较高预期。",
    score: buildScore("NVDA", { fundamentalScore: 92, valuationScore: 58, technicalScore: 83, catalystScore: 88, macroScore: 76, riskScore: 60 })
  },
  {
    ticker: "CEG",
    companyName: "Constellation Energy",
    market: "NASDAQ",
    status: "高波动",
    recommendation: "动量强，等估值降温",
    conclusion: "观察为主，等待更清晰入场区。",
    buyZone: "$275 - $292",
    sellZone: "$340 以上分批锁定收益",
    invalidPoint: "跌破 $260",
    analysis: "电力与 AI 数据中心叙事强，但估值与波动都偏高。",
    score: buildScore("CEG", { fundamentalScore: 78, valuationScore: 62, technicalScore: 84, catalystScore: 86, macroScore: 70, riskScore: 55 })
  },
  {
    ticker: "MSFT",
    companyName: "Microsoft",
    market: "NASDAQ",
    status: "关注",
    recommendation: "A，基本面强，技术面突破",
    conclusion: "高质量持有，可逢低加仓。",
    buyZone: "$420 - $438",
    sellZone: "$505 以上估值偏高",
    invalidPoint: "跌破 $405",
    analysis: "云、AI 与企业软件韧性强，风险主要来自估值扩张。",
    score: buildScore("MSFT", { fundamentalScore: 90, valuationScore: 78, technicalScore: 86, catalystScore: 84, macroScore: 80, riskScore: 76 })
  },
  {
    ticker: "GOOGL",
    companyName: "Alphabet",
    market: "NASDAQ",
    status: "估值合理",
    recommendation: "基本面稳，适合继续跟踪",
    conclusion: "继续持有，关注广告和云增长。",
    buyZone: "$168 - $176",
    sellZone: "$205 以上复核估值",
    invalidPoint: "跌破 $158",
    analysis: "搜索和云业务稳定，AI 产品商业化是主要催化。",
    score: buildScore("GOOGL", { fundamentalScore: 84, valuationScore: 82, technicalScore: 74, catalystScore: 76, macroScore: 75, riskScore: 74 })
  },
  {
    ticker: "META",
    companyName: "Meta Platforms",
    market: "NASDAQ",
    status: "关注",
    recommendation: "盈利强，关注资本开支风险",
    conclusion: "持有，等待回调加仓。",
    buyZone: "$455 - $472",
    sellZone: "$545 以上减仓",
    invalidPoint: "跌破 $430",
    analysis: "广告业务盈利强，AI 与 Reality Labs 投入影响市场预期。",
    score: buildScore("META", { fundamentalScore: 88, valuationScore: 76, technicalScore: 78, catalystScore: 78, macroScore: 74, riskScore: 66 })
  },
  {
    ticker: "AAPL",
    companyName: "Apple",
    market: "NASDAQ",
    status: "普通机会",
    recommendation: "等待增长重新加速",
    conclusion: "持有为主，暂不追高。",
    buyZone: "$185 - $195",
    sellZone: "$230 以上复核",
    invalidPoint: "跌破 $178",
    analysis: "现金流稳健，但增长弹性需要新产品或服务业务驱动。",
    score: buildScore("AAPL", { fundamentalScore: 80, valuationScore: 70, technicalScore: 72, catalystScore: 68, macroScore: 72, riskScore: 78 })
  }
];

export const watchlist: Watchlist[] = stocks.map((stock, index) => ({
  id: `watch-${stock.ticker.toLowerCase()}`,
  userId: user.id,
  ticker: stock.ticker,
  companyName: stock.companyName,
  market: stock.market,
  status: index < 4 ? "持仓" : "观察",
  createdAt: "2026-06-13T00:00:00.000Z"
}));

export const holdings: Holding[] = [
  { id: "holding-tsla", userId: user.id, ticker: "TSLA", shares: 120, averageCost: 169, currentPrice: 182, targetAllocation: 25, riskStatus: "高波动", createdAt: "2026-06-13T00:00:00.000Z", updatedAt: "2026-06-13T00:00:00.000Z" },
  { id: "holding-amzn", userId: user.id, ticker: "AMZN", shares: 80, averageCost: 171, currentPrice: 188, targetAllocation: 20, riskStatus: "持有", createdAt: "2026-06-13T00:00:00.000Z", updatedAt: "2026-06-13T00:00:00.000Z" },
  { id: "holding-nvda", userId: user.id, ticker: "NVDA", shares: 90, averageCost: 117, currentPrice: 133, targetAllocation: 18, riskStatus: "估值高", createdAt: "2026-06-13T00:00:00.000Z", updatedAt: "2026-06-13T00:00:00.000Z" },
  { id: "holding-ceg", userId: user.id, ticker: "CEG", shares: 28, averageCost: 289, currentPrice: 306, targetAllocation: 10, riskStatus: "观察", createdAt: "2026-06-13T00:00:00.000Z", updatedAt: "2026-06-13T00:00:00.000Z" }
];

export const alerts: Alert[] = [
  { id: "alert-1", userId: user.id, ticker: "TSLA", alertType: "technical", priority: "P0", title: "TSLA 接近关键支撑位", content: "若跌破 $158，当前持仓逻辑需要重新评估。", status: "open", createdAt: "2026-06-13T08:00:00.000Z" },
  { id: "alert-2", userId: user.id, alertType: "macro", priority: "P1", title: "本周 CPI 将于周三公布", content: "高估值成长股可能在数据公布前后放大波动。", status: "open", createdAt: "2026-06-13T08:00:00.000Z" },
  { id: "alert-3", userId: user.id, ticker: "NVDA", alertType: "earnings", priority: "P1", title: "NVDA 财报倒计时 3 天", content: "关注数据中心收入与下季度指引。", status: "open", createdAt: "2026-06-13T08:00:00.000Z" },
  { id: "alert-4", userId: user.id, ticker: "AMZN", alertType: "valuation", priority: "P2", title: "AMZN 进入加仓观察区", content: "若回调到 $178 - $188 且量能企稳，可复核买入计划。", status: "open", createdAt: "2026-06-13T08:00:00.000Z" }
];

export const events: EventItem[] = [
  { id: "event-1", date: "周一", type: "dividend", ticker: "AMZN", title: "分红相关日期跟踪", expectedImpact: "低", priority: "P3" },
  { id: "event-2", date: "周二", type: "PPI", title: "PPI 数据公布", expectedImpact: "中", priority: "P2" },
  { id: "event-3", date: "周三", type: "CPI", title: "CPI 数据公布", expectedImpact: "高", priority: "P1" },
  { id: "event-4", date: "周三", type: "FOMC", title: "FOMC 会议纪要", expectedImpact: "高", priority: "P1" },
  { id: "event-5", date: "周四", type: "earnings", ticker: "NVDA", title: "NVDA 财报", expectedImpact: "预计波动 ±7%", priority: "P1" },
  { id: "event-6", date: "周五", type: "GDP", title: "GDP 修正值", expectedImpact: "中", priority: "P2" },
  { id: "event-7", date: "周五", type: "filing", ticker: "TSLA", title: "公司公告窗口", expectedImpact: "中", priority: "P2" }
];

export const backtests: BacktestResult[] = [
  { id: "bt-nvda", ticker: "NVDA", signalType: "回踩 50 日均线后反弹", sampleSize: 23, winRate5d: 61, winRate20d: 65, winRate60d: 67, avgReturn20d: 5.8, maxDrawdown: -10.2, profitLossRatio: 1.7, signalGrade: "B+", createdAt: "2026-06-13T00:00:00.000Z" },
  { id: "bt-amzn", ticker: "AMZN", signalType: "财报后超预期且股价不跌", sampleSize: 21, winRate5d: 57, winRate20d: 62, winRate60d: 66, avgReturn20d: 4.7, maxDrawdown: -8.9, profitLossRatio: 1.6, signalGrade: "B+", createdAt: "2026-06-13T00:00:00.000Z" },
  { id: "bt-msft", ticker: "MSFT", signalType: "放量突破前高", sampleSize: 19, winRate5d: 63, winRate20d: 68, winRate60d: 70, avgReturn20d: 4.2, maxDrawdown: -6.5, profitLossRatio: 1.8, signalGrade: "A-", createdAt: "2026-06-13T00:00:00.000Z" },
  { id: "bt-tsla", ticker: "TSLA", signalType: "跌至关键支撑后反弹", sampleSize: 28, winRate5d: 54, winRate20d: 58, winRate60d: 60, avgReturn20d: 3.1, maxDrawdown: -14.6, profitLossRatio: 1.2, signalGrade: "B", createdAt: "2026-06-13T00:00:00.000Z" }
];

export const marketStatus = {
  label: "中性偏强",
  summary: "大型科技维持强势，宏观数据公布前波动可能上升。"
};

export const dailyBriefing: DailyBriefing = {
  market: ["美股成长板块中性偏强。", "CPI 与 FOMC 事件前，仓位不宜过度集中。"],
  portfolioRisk: ["TSLA 当前仓位和波动都偏高。", "AI / 半导体相关标的相关性较高。"],
  opportunities: ["MSFT 综合评分领先，可关注回调机会。", "AMZN 基本面稳定，进入加仓观察区。"],
  risks: ["NVDA 财报前估值预期较高。", "CEG 动量强但回撤风险偏高。"],
  upcomingEvents: events.slice(0, 5).map((event) => `${event.date}：${event.title}`)
};
