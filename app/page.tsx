"use client";

import { useEffect, useMemo, useState } from "react";
import { BriefingPanel } from "@/components/briefing-panel";
import { DataTable } from "@/components/data-table";
import { useLanguage } from "@/components/language-provider";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { ScoreBadge } from "@/components/score-badge";
import { alerts, dailyBriefing, holdings as mockHoldings, marketStatus, stocks } from "@/lib/mock-data";
import { getPortfolioSummary } from "@/lib/portfolio";
import type { Holding } from "@/lib/types";

type AiScoreSummary = {
  ticker: string;
  score: number;
  rating: string;
  ratingLabel?: string;
  price: number;
  changesPercentage: number;
  assetType?: "ETF";
  scoreMode?: "full" | "market_only" | "estimated";
  dataSource?: "真实数据" | "缓存数据" | "估算数据" | "示例数据";
  stale?: boolean;
};

export default function DashboardPage() {
  const { t } = useLanguage();
  const [aiRadarScores, setAiRadarScores] = useState<AiScoreSummary[]>([]);
  const [aiRadarError, setAiRadarError] = useState<string | null>(null);
  const [isAiRadarLoading, setIsAiRadarLoading] = useState(true);
  const summary = getPortfolioSummary(mockHoldings);
  const opportunities = stocks.filter((stock) => stock.score.totalScore >= 76).slice(0, 4);
  const topAiRadarScores = useMemo(() => [...aiRadarScores].sort((a, b) => b.score - a.score).slice(0, 3), [aiRadarScores]);

  useEffect(() => {
    let cancelled = false;

    async function loadAiRadarSummary() {
      setIsAiRadarLoading(true);
      setAiRadarError(null);

      try {
        const holdingsResponse = await fetch("/api/holdings", { cache: "no-store" });
        const holdingsData = await holdingsResponse.json();

        if (!holdingsResponse.ok) throw new Error(holdingsData.error ?? t("loadHoldingsError"));

        const tickers = Array.from(
          new Set((holdingsData as Holding[]).map((holding) => holding.ticker.trim().toUpperCase()).filter(Boolean))
        );

        if (!tickers.length) {
          if (!cancelled) setAiRadarScores([]);
          return;
        }

        const scoreResponse = await fetch(`/api/ai-score/batch?tickers=${encodeURIComponent(tickers.join(","))}`, { cache: "no-store" });
        const scoreData = await scoreResponse.json();

        if (cancelled) return;

        setAiRadarScores(Array.isArray(scoreData.results) ? scoreData.results : []);
        if (Array.isArray(scoreData.errors) && scoreData.errors.length) {
          setAiRadarError(t("someAiScoresUnavailable"));
        } else if (!scoreResponse.ok) {
          setAiRadarError(t("aiScoresTemporarilyUnavailable"));
        }
      } catch {
        if (!cancelled) {
          setAiRadarScores([]);
          setAiRadarError(t("aiRadarUnavailable"));
        }
      } finally {
        if (!cancelled) setIsAiRadarLoading(false);
      }
    }

    loadAiRadarSummary();

    return () => {
      cancelled = true;
    };
  }, [t]);

  return (
    <div className="space-y-6">
      <PageHeader title={t("dashboard")} eyebrow="StockRadar AI" description={t("dashboardDescription")} />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label={t("todayMarketStatus")} value={marketStatus.label} detail={marketStatus.summary} tone="blue" />
        <MetricCard label={t("portfolioMarketValue")} value={`$${summary.totalValue.toLocaleString()}`} detail={`${t("todayPL")} ${summary.dayChangePercent}%`} tone="green" />
        <MetricCard label={t("largestHolding")} value={`${summary.largestHolding.ticker} ${summary.largestHolding.allocation}%`} detail="< 35%" tone="amber" />
        <MetricCard label={t("portfolioRiskLevel")} value={summary.riskLevel} detail={summary.riskNotes[0]} tone="red" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-lg border border-line bg-white p-5 shadow-soft">
          <h2 className="text-lg font-semibold">{t("importantAlerts")}</h2>
          <div className="mt-4 space-y-3">
            {alerts.slice(0, 4).map((alert) => (
              <div key={alert.id} className="flex gap-3 rounded-md border border-line bg-panel p-3">
                <span className="h-fit rounded bg-ink px-2 py-1 text-xs font-semibold text-white">{alert.priority}</span>
                <div>
                  <p className="font-medium">{alert.title}</p>
                  <p className="mt-1 text-sm text-muted">{alert.content}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <BriefingPanel briefing={dailyBriefing} />
      </section>

      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{t("aiRadarSummary")}</h2>
            <p className="mt-1 text-sm text-muted">{t("aiRadarSummaryDescription")}</p>
          </div>
          {isAiRadarLoading ? <span className="text-sm text-muted">{t("loadingAiScores")}</span> : null}
        </div>

        {aiRadarError ? <p className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">{aiRadarError}</p> : null}

        {!isAiRadarLoading && topAiRadarScores.length === 0 ? (
          <p className="rounded-md border border-line bg-panel px-3 py-4 text-sm text-muted">{t("noAiScoresAvailable")}</p>
        ) : (
          <DataTable
            columns={[t("ticker"), t("score"), t("rating"), t("currentPrice"), t("changePercent")]}
            rows={topAiRadarScores.map((score) => [
              score.ticker,
              <ScoreBadge key={`${score.ticker}-ai-score`} score={score.score} />,
              <div key={`${score.ticker}-rating`}>
                <p>{score.ratingLabel ? `${score.rating} / ${score.ratingLabel}` : getV2RatingLabel(score.rating)}</p>
                {score.scoreMode === "market_only" ? <p className="text-xs text-muted">{t("marketOnlyScore")}</p> : null}
                {score.scoreMode === "estimated" ? <p className="text-xs text-muted">含估算维度</p> : null}
                {score.assetType === "ETF" ? <p className="text-xs text-muted">{t("etfDataNotice")}</p> : null}
                {score.stale ? <p className="text-xs text-amber-700">{t("usingCachedData")}</p> : null}
                {score.dataSource ? <p className="text-xs text-muted">{score.dataSource}</p> : null}
              </div>,
              formatCurrency(score.price),
              <span key={`${score.ticker}-change`} className={score.changesPercentage >= 0 ? "text-green-600" : "text-red-600"}>
                {formatPercent(score.changesPercentage)}
              </span>
            ])}
          />
        )}
      </section>

      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">{t("todayOpportunities")}</h2>
          <span className="text-sm text-muted">{t("basedOnMockScoring")}</span>
        </div>
        <DataTable
          columns={[t("ticker"), t("company"), t("totalScore"), t("status"), t("recommendation")]}
          rows={opportunities.map((stock) => [
            stock.ticker,
            stock.companyName,
            <ScoreBadge key={`${stock.ticker}-score`} score={stock.score.totalScore} />,
            stock.status,
            stock.recommendation
          ])}
        />
      </section>
    </div>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
}

function formatPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function getV2RatingLabel(rating: string) {
  if (rating === "Strong Buy") return "Strong Buy / 强烈买入观察";
  if (rating === "Buy") return "Buy / 买入观察";
  if (rating === "Hold") return "Hold / 持有观察";
  if (rating === "Watch") return "Watch / 谨慎观察";
  if (rating === "Avoid") return "Avoid / 回避";
  return rating;
}
