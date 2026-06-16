"use client";

import Link from "next/link";
import { BacktestSummary } from "@/components/backtest-summary";
import { useLanguage } from "@/components/language-provider";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { ScoreBadge } from "@/components/score-badge";
import { backtests, stocks } from "@/lib/mock-data";
import { gradeFromScore } from "@/lib/scoring";

export default function StockDetailPage({ params }: { params: { ticker: string } }) {
  const { t } = useLanguage();
  const stock = stocks.find((item) => item.ticker === params.ticker.toUpperCase());
  if (!stock) {
    return <div className="rounded-lg border border-line bg-white p-5">{t("stockNotFound")}</div>;
  }
  const backtest = backtests.find((item) => item.ticker === stock.ticker);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${stock.ticker} ${stock.companyName}`}
        eyebrow={t("stockDetail")}
        description={stock.analysis}
        action={<Link href="/radar" className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white">{t("backToRadar")}</Link>}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <MetricCard label={t("totalScore")} value={<ScoreBadge score={stock.score.totalScore} />} detail={gradeFromScore(stock.score.totalScore)} />
        <MetricCard label={t("fundamental")} value={stock.score.fundamentalScore} detail={gradeFromScore(stock.score.fundamentalScore)} />
        <MetricCard label={t("valuation")} value={stock.score.valuationScore} detail={gradeFromScore(stock.score.valuationScore)} />
        <MetricCard label={t("technical")} value={stock.score.technicalScore} detail={gradeFromScore(stock.score.technicalScore)} />
        <MetricCard label={t("catalyst")} value={stock.score.catalystScore} detail={gradeFromScore(stock.score.catalystScore)} />
        <MetricCard label={t("riskScore")} value={stock.score.riskScore} detail={t("higherIsBetter")} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <div className="rounded-lg border border-line bg-white p-5 shadow-soft">
          <h2 className="text-lg font-semibold">{t("currentConclusion")}</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Info label={t("conclusion")} value={stock.conclusion} />
            <Info label={t("buyZone")} value={stock.buyZone} />
            <Info label={t("sellZone")} value={stock.sellZone} />
            <Info label={t("invalidPoint")} value={stock.invalidPoint} />
          </div>
        </div>
        {backtest ? <BacktestSummary result={backtest} /> : null}
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-panel p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 font-semibold">{value}</p>
    </div>
  );
}
