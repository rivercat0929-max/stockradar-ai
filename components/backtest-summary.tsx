"use client";

import { useLanguage } from "@/components/language-provider";
import type { BacktestResult } from "@/lib/types";

export function BacktestSummary({ result }: { result: BacktestResult }) {
  const { t } = useLanguage();

  return (
    <div className="rounded-lg border border-line bg-white p-5 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t("historicalSimilarSignals")}</h2>
          <p className="mt-1 text-sm text-muted">{result.ticker} · {result.signalType}</p>
        </div>
        <span className="rounded bg-ink px-3 py-1 text-sm font-semibold text-white">{result.signalGrade}</span>
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-3">
        <Stat label={t("sampleSize")} value={`${result.sampleSize} ${t("times")}`} />
        <Stat label={t("winRate20d")} value={`${result.winRate20d}%`} />
        <Stat label={t("avgReturn")} value={`${result.avgReturn20d}%`} />
        <Stat label={t("maxDrawdown")} value={`${result.maxDrawdown}%`} />
        <Stat label={t("winRate5d")} value={`${result.winRate5d}%`} />
        <Stat label={t("winRate60d")} value={`${result.winRate60d}%`} />
      </dl>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-panel p-3">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="mt-1 font-semibold">{value}</dd>
    </div>
  );
}
