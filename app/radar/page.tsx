"use client";

import Link from "next/link";
import { DataTable } from "@/components/data-table";
import { useLanguage } from "@/components/language-provider";
import { PageHeader } from "@/components/page-header";
import { ScoreBadge } from "@/components/score-badge";
import { stocks } from "@/lib/mock-data";
import { gradeFromScore } from "@/lib/scoring";

export default function RadarPage() {
  const { t } = useLanguage();

  return (
    <div className="space-y-6">
      <PageHeader title={t("radar")} eyebrow="Radar" description={t("radarDescription")} />

      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <div className="mb-4 flex flex-wrap gap-2">
          {[t("growthStocks"), t("reasonableValuation"), t("technicalBreakout"), t("earningsBeat")].map((filter) => (
            <span key={filter} className="rounded bg-panel px-3 py-1 text-sm font-medium text-muted">{filter}</span>
          ))}
        </div>
        <DataTable
          columns={[t("ticker"), t("company"), t("totalScore"), t("fundamental"), t("valuation"), t("technical"), t("status"), t("recommendation"), t("details")]}
          rows={stocks.map((stock) => [
            stock.ticker,
            stock.companyName,
            <ScoreBadge key={`${stock.ticker}-score`} score={stock.score.totalScore} />,
            gradeFromScore(stock.score.fundamentalScore),
            gradeFromScore(stock.score.valuationScore),
            gradeFromScore(stock.score.technicalScore),
            stock.status,
            stock.recommendation,
            <Link key={`${stock.ticker}-link`} href={`/stocks/${stock.ticker}`} className="text-sm font-semibold text-signal">{t("view")}</Link>
          ])}
        />
      </section>
    </div>
  );
}
