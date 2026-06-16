import type { Holding } from "@/lib/types";

export type PortfolioHoldingAnalysis = {
  ticker: string;
  companyName: string;
  industry: string;
  shares: number;
  currentPrice: number;
  marketValue: number;
  allocationPercent: number;
  beta: number;
};

export type PortfolioIndustryAnalysis = {
  industry: string;
  marketValue: number;
  allocationPercent: number;
};

export type PortfolioStressTest = {
  scenario: string;
  drawdownValue: number;
  drawdownPercent: number;
};

export type PortfolioAnalytics = {
  totalAssets: number;
  holdings: PortfolioHoldingAnalysis[];
  industries: PortfolioIndustryAnalysis[];
  topThreeAllocationPercent: number;
  hhi: number;
  largestHolding: PortfolioHoldingAnalysis | null;
  largestHoldingRisk: string;
  technologyAllocationPercent: number;
  estimatedBeta: number;
  riskScore: number;
  stressTests: PortfolioStressTest[];
  suggestions: string[];
};

const industryByTicker: Record<string, string> = {
  AAPL: "科技",
  MSFT: "科技",
  NVDA: "科技",
  TSLA: "可选消费",
  AMZN: "可选消费",
  GOOGL: "通信服务",
  META: "通信服务",
  CEG: "公用事业",
  TQQQ: "科技",
  SOXL: "科技",
  TSLL: "可选消费",
  QQQ: "科技",
  SPY: "综合指数",
  VOO: "综合指数",
  SCHD: "防御性资产",
  XLU: "公用事业",
  XLV: "医疗保健"
};

const betaByTicker: Record<string, number> = {
  AAPL: 1.2,
  MSFT: 1.1,
  NVDA: 1.8,
  TSLA: 2.0,
  AMZN: 1.4,
  GOOGL: 1.2,
  META: 1.3,
  CEG: 0.8,
  TQQQ: 3.0,
  SOXL: 3.2,
  TSLL: 2.8,
  QQQ: 1.2,
  SPY: 1.0,
  VOO: 1.0,
  SCHD: 0.8,
  XLU: 0.6,
  XLV: 0.7
};

export function calculateHoldingMetrics(holdings: Holding[]) {
  const totalValue = holdings.reduce((sum, item) => sum + item.shares * (item.currentPrice ?? item.averageCost), 0);
  return holdings.map((item) => {
    const currentPrice = item.currentPrice ?? item.averageCost;
    const value = item.shares * currentPrice;
    const cost = item.shares * item.averageCost;
    const pnl = value - cost;
    return {
      ...item,
      currentPrice,
      value: Math.round(value),
      pnl: Math.round(pnl),
      pnlPercent: cost > 0 ? Number(((pnl / cost) * 100).toFixed(1)) : 0,
      allocation: totalValue > 0 ? Number(((value / totalValue) * 100).toFixed(1)) : 0
    };
  });
}

export function getPortfolioSummary(holdings: Holding[]) {
  const metrics = calculateHoldingMetrics(holdings);
  const totalValue = metrics.reduce((sum, item) => sum + item.value, 0);
  const largestHolding = metrics.reduce(
    (largest, item) => (item.allocation > largest.allocation ? item : largest),
    metrics[0] ?? { ticker: "N/A", allocation: 0 }
  );
  const highAllocation = metrics.filter((item) => item.allocation > (item.targetAllocation ?? 0) + 10);
  return {
    totalValue,
    dayChangePercent: "+1.2",
    largestHolding,
    riskLevel: highAllocation.length > 0 ? "中高" : "中性",
    riskNotes: [
      highAllocation.length > 0 ? `${highAllocation[0].ticker} 仓位高于目标，建议复核。` : "单股仓位基本在目标范围内。",
      "科技与 AI 相关标的集中度较高。",
      "财报和宏观事件前后波动可能放大。"
    ]
  };
}

export function analyzePortfolio(holdings: Holding[]): PortfolioAnalytics {
  const analyzedHoldings = holdings
    .map((holding) => {
      const ticker = holding.ticker.trim().toUpperCase();
      const currentPrice = holding.currentPrice ?? holding.averageCost ?? 0;
      const marketValue = holding.marketValue ?? holding.shares * currentPrice;

      return {
        ticker,
        companyName: holding.companyName ?? ticker,
        industry: getIndustry(ticker),
        shares: holding.shares,
        currentPrice,
        marketValue: roundMoney(marketValue),
        allocationPercent: 0,
        beta: getBeta(ticker)
      };
    })
    .filter((holding) => holding.marketValue > 0);

  const totalAssets = roundMoney(analyzedHoldings.reduce((sum, holding) => sum + holding.marketValue, 0));
  const holdingsWithAllocation = analyzedHoldings
    .map((holding) => ({
      ...holding,
      allocationPercent: totalAssets > 0 ? roundPercent((holding.marketValue / totalAssets) * 100) : 0
    }))
    .sort((a, b) => b.marketValue - a.marketValue);

  const industries = getIndustryDistribution(holdingsWithAllocation, totalAssets);
  const topThreeAllocationPercent = roundPercent(holdingsWithAllocation.slice(0, 3).reduce((sum, holding) => sum + holding.allocationPercent, 0));
  const hhi = roundNumber(holdingsWithAllocation.reduce((sum, holding) => sum + Math.pow(holding.allocationPercent / 100, 2), 0) * 10000, 0);
  const largestHolding = holdingsWithAllocation[0] ?? null;
  const technologyAllocationPercent = roundPercent(
    industries.filter((item) => item.industry === "科技").reduce((sum, item) => sum + item.allocationPercent, 0)
  );
  const estimatedBeta = totalAssets > 0 ? roundNumber(holdingsWithAllocation.reduce((sum, holding) => sum + (holding.marketValue / totalAssets) * holding.beta, 0), 2) : 0;
  const riskScore = getRiskScore({ hhi, largestAllocation: largestHolding?.allocationPercent ?? 0, technologyAllocationPercent, estimatedBeta });

  return {
    totalAssets,
    holdings: holdingsWithAllocation,
    industries,
    topThreeAllocationPercent,
    hhi,
    largestHolding,
    largestHoldingRisk: getLargestHoldingRisk(largestHolding?.allocationPercent ?? 0),
    technologyAllocationPercent,
    estimatedBeta,
    riskScore,
    stressTests: getStressTests({ totalAssets, holdings: holdingsWithAllocation, technologyAllocationPercent }),
    suggestions: getSuggestions({
      largestHolding,
      topThreeAllocationPercent,
      technologyAllocationPercent,
      estimatedBeta,
      riskScore
    })
  };
}

function getIndustryDistribution(holdings: PortfolioHoldingAnalysis[], totalAssets: number) {
  const byIndustry = new Map<string, number>();
  holdings.forEach((holding) => {
    byIndustry.set(holding.industry, (byIndustry.get(holding.industry) ?? 0) + holding.marketValue);
  });

  return Array.from(byIndustry.entries())
    .map(([industry, marketValue]) => ({
      industry,
      marketValue: roundMoney(marketValue),
      allocationPercent: totalAssets > 0 ? roundPercent((marketValue / totalAssets) * 100) : 0
    }))
    .sort((a, b) => b.marketValue - a.marketValue);
}

function getStressTests({
  totalAssets,
  holdings,
  technologyAllocationPercent
}: {
  totalAssets: number;
  holdings: PortfolioHoldingAnalysis[];
  technologyAllocationPercent: number;
}): PortfolioStressTest[] {
  const largestHoldingValue = holdings[0]?.marketValue ?? 0;
  const maxHoldingDrawdown = largestHoldingValue * 0.2;
  const techDrawdown = totalAssets * (technologyAllocationPercent / 100) * 0.3;
  const marketDrawdown = totalAssets * 0.2;

  return [
    toStressTest("最大持仓跌20%", maxHoldingDrawdown, totalAssets),
    toStressTest("科技股整体跌30%", techDrawdown, totalAssets),
    toStressTest("市场跌20%", marketDrawdown, totalAssets)
  ];
}

function toStressTest(scenario: string, drawdownValue: number, totalAssets: number) {
  return {
    scenario,
    drawdownValue: roundMoney(drawdownValue),
    drawdownPercent: totalAssets > 0 ? roundPercent((drawdownValue / totalAssets) * 100) : 0
  };
}

function getSuggestions({
  largestHolding,
  topThreeAllocationPercent,
  technologyAllocationPercent,
  estimatedBeta,
  riskScore
}: {
  largestHolding: PortfolioHoldingAnalysis | null;
  topThreeAllocationPercent: number;
  technologyAllocationPercent: number;
  estimatedBeta: number;
  riskScore: number;
}) {
  const suggestions: string[] = [];

  if (largestHolding && largestHolding.allocationPercent > 25) {
    suggestions.push(`${largestHolding.ticker} 仓位超过 25%，建议逐步降低单一持仓风险。`);
  }

  if (topThreeAllocationPercent > 60) {
    suggestions.push("前三大持仓占比较高，建议增加更多低相关资产。");
  }

  if (technologyAllocationPercent > 45) {
    suggestions.push("科技行业集中度较高，建议增加医疗、公用事业或股息资产。");
  }

  if (estimatedBeta > 1.3 || riskScore > 70) {
    suggestions.push("组合波动敏感度偏高，建议提高现金比例以应对回撤。");
  }

  if (suggestions.length < 2) {
    suggestions.push("当前组合风险较均衡，可继续保持定期再平衡。");
  }

  suggestions.push("建议配置一定比例的防御性资产，例如现金、短债、股息 ETF 或公用事业板块。");
  return suggestions;
}

function getRiskScore({
  hhi,
  largestAllocation,
  technologyAllocationPercent,
  estimatedBeta
}: {
  hhi: number;
  largestAllocation: number;
  technologyAllocationPercent: number;
  estimatedBeta: number;
}) {
  const concentrationRisk = Math.min(35, hhi / 100);
  const largestRisk = Math.min(25, largestAllocation);
  const technologyRisk = Math.min(25, technologyAllocationPercent * 0.45);
  const betaRisk = Math.min(15, Math.max(0, estimatedBeta - 0.8) * 20);
  return roundNumber(concentrationRisk + largestRisk + technologyRisk + betaRisk, 0);
}

function getLargestHoldingRisk(allocationPercent: number) {
  if (allocationPercent >= 35) return "高风险";
  if (allocationPercent >= 25) return "中高风险";
  if (allocationPercent >= 15) return "中等风险";
  return "较低风险";
}

function getIndustry(ticker: string) {
  return industryByTicker[ticker] ?? "其他";
}

function getBeta(ticker: string) {
  return betaByTicker[ticker] ?? 1.1;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function roundPercent(value: number) {
  return roundNumber(value, 1);
}

function roundNumber(value: number, digits: number) {
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
}
