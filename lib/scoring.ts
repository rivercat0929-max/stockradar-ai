import type { StockScore } from "@/lib/types";

export function calculateTotalScore(input: Omit<StockScore, "id" | "ticker" | "totalScore" | "scoreDate">) {
  return Math.round(
    input.fundamentalScore * 0.3 +
      input.valuationScore * 0.2 +
      input.technicalScore * 0.2 +
      input.catalystScore * 0.15 +
      input.macroScore * 0.1 +
      input.riskScore * 0.05
  );
}

export function gradeFromScore(score: number) {
  if (score >= 85) return "A";
  if (score >= 75) return "B+";
  if (score >= 65) return "B";
  if (score >= 50) return "C";
  return "D";
}

export function buildScore(ticker: string, scores: Omit<StockScore, "id" | "ticker" | "totalScore" | "scoreDate">): StockScore {
  return {
    id: `score-${ticker.toLowerCase()}`,
    ticker,
    ...scores,
    totalScore: calculateTotalScore(scores),
    scoreDate: "2026-06-13"
  };
}
