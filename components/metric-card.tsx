import type { ReactNode } from "react";

const toneClass = {
  blue: "border-signal/30 bg-blue-50",
  green: "border-gain/30 bg-green-50",
  amber: "border-amber-300 bg-amber-50",
  red: "border-loss/30 bg-red-50",
  neutral: "border-line bg-white"
};

export function MetricCard({
  label,
  value,
  detail,
  tone = "neutral"
}: {
  label: string;
  value: ReactNode;
  detail?: string;
  tone?: keyof typeof toneClass;
}) {
  return (
    <div className={`rounded-lg border p-4 shadow-soft ${toneClass[tone]}`}>
      <p className="text-sm font-medium text-muted">{label}</p>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      {detail ? <p className="mt-2 text-sm text-muted">{detail}</p> : null}
    </div>
  );
}
