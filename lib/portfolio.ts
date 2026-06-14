import type { Holding } from "@/lib/types";

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
