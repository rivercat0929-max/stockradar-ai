import { gradeFromScore } from "@/lib/scoring";

export function ScoreBadge({ score }: { score: number }) {
  const tone = score >= 85 ? "bg-green-100 text-gain" : score >= 75 ? "bg-blue-100 text-signal" : score >= 65 ? "bg-amber-100 text-amber-800" : "bg-red-100 text-loss";

  return (
    <span className={`inline-flex min-w-20 items-center justify-center rounded px-2 py-1 text-sm font-semibold ${tone}`}>
      {score} · {gradeFromScore(score)}
    </span>
  );
}
