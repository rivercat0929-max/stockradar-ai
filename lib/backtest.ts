import type { BacktestResult } from "@/lib/types";

export function summarizeBacktest(result: BacktestResult) {
  const isReliable = result.sampleSize >= 20 && result.winRate20d >= 60 && result.profitLossRatio >= 1.5;
  return {
    ...result,
    reliability: isReliable ? "样本可参考" : "样本需谨慎",
    downsideLabel: result.maxDrawdown <= -10 ? "回撤偏高" : "回撤可控"
  };
}
