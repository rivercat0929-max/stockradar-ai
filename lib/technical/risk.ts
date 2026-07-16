import type { TechnicalMetrics } from "@/lib/technical/indicators";

export function calculateTechnicalRisk(metrics: TechnicalMetrics, marketCap: number | null) {
  return {
    volatility20: metrics.volatility20,
    volatility60: metrics.volatility60,
    maxDrawdown: metrics.maxDrawdown,
    marketCap,
    liquidity: metrics.averageVolume20,
    validCount: [metrics.volatility20, metrics.volatility60, metrics.maxDrawdown, marketCap, metrics.averageVolume20].filter(isNumber).length
  };
}

function isNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value);
}
