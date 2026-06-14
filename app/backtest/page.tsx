"use client";

import { BacktestSummary } from "@/components/backtest-summary";
import { DataTable } from "@/components/data-table";
import { Disclaimer } from "@/components/disclaimer";
import { useLanguage } from "@/components/language-provider";
import { PageHeader } from "@/components/page-header";
import { backtests } from "@/lib/mock-data";

export default function BacktestPage() {
  const { t } = useLanguage();

  return (
    <div className="space-y-6">
      <PageHeader title={t("backtest")} eyebrow={t("backtest")} description={t("backtestDescription")} />

      <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <BacktestSummary result={backtests[0]} />
        <div className="rounded-lg border border-line bg-white p-5 shadow-soft">
          <DataTable
            columns={[t("ticker"), t("signalType"), t("sample"), t("winRate5d"), t("winRate20d"), t("winRate60d"), t("avgReturn"), t("maxDrawdown"), t("grade")]}
            rows={backtests.map((result) => [
              result.ticker,
              result.signalType,
              result.sampleSize,
              `${result.winRate5d}%`,
              `${result.winRate20d}%`,
              `${result.winRate60d}%`,
              `${result.avgReturn20d}%`,
              `${result.maxDrawdown}%`,
              result.signalGrade
            ])}
          />
        </div>
      </section>

      <Disclaimer />
    </div>
  );
}
