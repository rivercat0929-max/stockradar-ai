"use client";

import { useEffect, useMemo, useState } from "react";
import { DataSourceBadge } from "@/components/data-source-badge";
import { DataTable } from "@/components/data-table";
import { useLanguage } from "@/components/language-provider";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { ScoreBadge } from "@/components/score-badge";
import type { MarketQuote } from "@/lib/market-data";
import type { Holding } from "@/lib/types";

type DashboardHolding = Holding & {
  quote?: MarketQuote;
  currentPrice?: number | null;
  marketValue?: number | null;
  totalCost?: number | null;
  unrealizedPL?: number | null;
  unrealizedPLPercent?: number | null;
  allocation?: number | null;
};

type AiScoreSummary = {
  ticker: string;
  score: number;
  rating: string;
  ratingLabel?: string;
  price: number | null;
  changesPercentage: number | null;
  assetType?: "ETF";
  scoreMode?: "full" | "market_only" | "estimated";
  dataSource?: string;
  stale?: boolean;
  marketQuote?: MarketQuote;
};

export default function DashboardPage() {
  const { t } = useLanguage();
  const [holdings, setHoldings] = useState<DashboardHolding[]>([]);
  const [aiRadarScores, setAiRadarScores] = useState<AiScoreSummary[]>([]);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [aiRadarError, setAiRadarError] = useState<string | null>(null);
  const [holdingsLoading, setHoldingsLoading] = useState(true);
  const [isAiRadarLoading, setIsAiRadarLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      setHoldingsLoading(true);
      setIsAiRadarLoading(true);
      setDashboardError(null);
      setAiRadarError(null);

      try {
        const holdingsResponse = await fetch("/api/holdings", { cache: "no-store" });
        const holdingsData = await holdingsResponse.json();
        if (!holdingsResponse.ok) throw new Error(holdingsData.error ?? t("loadHoldingsError"));

        const nextHoldings = Array.isArray(holdingsData) ? (holdingsData as DashboardHolding[]) : [];
        if (cancelled) return;
        setHoldings(nextHoldings);

        const tickers = Array.from(new Set(nextHoldings.map((holding) => holding.ticker.trim().toUpperCase()).filter(Boolean)));
        if (!tickers.length) {
          setAiRadarScores([]);
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
          setHoldings([]);
          setAiRadarScores([]);
          setDashboardError("首页数据暂时不可用，请稍后刷新。");
          setAiRadarError(t("aiRadarUnavailable"));
        }
      } finally {
        if (!cancelled) {
          setHoldingsLoading(false);
          setIsAiRadarLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [t]);

  const summary = useMemo(() => holdingsLoading ? null : getDashboardSummary(holdings), [holdings, holdingsLoading]);
  const topAiRadarScores = useMemo(() => [...aiRadarScores].sort((a, b) => b.score - a.score).slice(0, 3), [aiRadarScores]);
  const holdingRows = useMemo(() => holdings.slice(0, 5), [holdings]);

  return (
    <div className="space-y-6">
      <PageHeader title={t("dashboard")} eyebrow="StockRadar AI" description={t("dashboardDescription")} />

      {dashboardError ? <p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">{dashboardError}</p> : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="数据状态" value={holdingsLoading ? "正在加载" : summary?.dataStatus ?? "暂无数据"} detail={holdingsLoading ? "正在加载持仓..." : "首页仅使用真实持仓与统一行情服务"} tone="blue" />
        <MetricCard label={t("portfolioMarketValue")} value={holdingsLoading ? "--" : formatNullableCurrency(summary?.totalMarketValue)} detail={holdingsLoading ? "正在加载持仓..." : `${t("todayPL")} ${formatNullableSignedCurrency(summary?.todayChangeValue)} / ${formatNullablePercent(summary?.todayChangePercent)}`} tone="green" />
        <MetricCard label={t("largestHolding")} value={holdingsLoading ? "正在加载" : summary?.largestHolding ? `${summary.largestHolding.ticker} ${formatPercent(summary.largestHolding.allocation)}` : "暂无持仓"} detail={holdingsLoading ? "正在加载持仓..." : summary?.largestHolding ? `当前价 ${formatNullableCurrency(summary.largestHolding.currentPrice)}` : "添加持仓后显示真实占比"} tone="amber" />
        <MetricCard label={t("portfolioRiskLevel")} value={holdingsLoading ? "正在加载" : summary?.riskLevel ?? "暂无数据"} detail={holdingsLoading ? "正在加载持仓..." : summary?.riskNote ?? "添加持仓后显示集中度"} tone={holdingsLoading || summary?.riskLevel === "暂无数据" ? "neutral" : summary?.riskLevel === "偏高" ? "red" : "green"} />
      </section>

      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">持仓行情摘要</h2>
            <p className="mt-1 text-sm text-muted">基于 `/api/holdings` 与统一 market-data 服务计算。</p>
          </div>
          {holdingsLoading ? <span className="text-sm text-muted">正在加载持仓...</span> : null}
        </div>

        {holdingsLoading ? (
          <LoadingState message="正在加载持仓..." />
        ) : holdings.length === 0 ? (
          <p className="rounded-md border border-line bg-panel px-3 py-8 text-center text-sm text-muted">暂无持仓。首页不会自动显示示例股票。</p>
        ) : (
          <DataTable
            columns={[t("ticker"), t("shares"), t("currentPrice"), "数据来源", t("marketValue"), t("unrealizedPL")]}
            rows={holdingRows.map((holding) => [
              holding.ticker,
              formatNumber(holding.shares),
              formatNullableCurrency(holding.currentPrice),
              <DataSourceBadge key={`${holding.ticker}-source`} quote={holding.quote ?? null} />,
              formatNullableCurrency(holding.marketValue),
              <span key={`${holding.ticker}-pl`} className={getGainLossClass(holding.unrealizedPL)}>{formatNullableSignedCurrency(holding.unrealizedPL)}</span>
            ])}
          />
        )}
      </section>

      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">AI 雷达摘要</h2>
            <p className="mt-1 text-sm text-muted">仅从当前真实持仓中读取 AI 评分，不显示固定 Top Picks。</p>
          </div>
          {isAiRadarLoading ? <span className="text-sm text-muted">{t("loadingAiScores")}</span> : null}
        </div>

        {aiRadarError ? <p className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">{aiRadarError}</p> : null}

        {!isAiRadarLoading && topAiRadarScores.length === 0 ? (
          <p className="rounded-md border border-line bg-panel px-3 py-4 text-sm text-muted">暂无可用 AI 评分。没有持仓或行情数据不足时不会显示示例推荐。</p>
        ) : (
          <DataTable
            columns={[t("ticker"), t("score"), t("rating"), t("currentPrice"), "数据来源", t("changePercent")]}
            rows={topAiRadarScores.map((score) => [
              score.ticker,
              <ScoreBadge key={`${score.ticker}-ai-score`} score={score.score} />,
              <div key={`${score.ticker}-rating`}>
                <p>{score.ratingLabel ? `${score.rating} / ${score.ratingLabel}` : getV2RatingLabel(score.rating)}</p>
                {score.scoreMode === "market_only" ? <p className="text-xs text-muted">{t("marketOnlyScore")}</p> : null}
                {score.scoreMode === "estimated" ? <p className="text-xs text-muted">含估算维度</p> : null}
                {score.assetType === "ETF" ? <p className="text-xs text-muted">{t("etfDataNotice")}</p> : null}
              </div>,
              formatNullableCurrency(score.price),
              <DataSourceBadge key={`${score.ticker}-source`} quote={score.marketQuote ?? null} />,
              <span key={`${score.ticker}-change`} className={getGainLossClass(score.changesPercentage)}>
                {formatNullablePercent(score.changesPercentage)}
              </span>
            ])}
          />
        )}
      </section>

      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <h2 className="text-lg font-semibold">市场机会</h2>
        <p className="mt-3 rounded-md border border-line bg-panel px-3 py-4 text-sm text-muted">暂无真实机会数据源。旧的固定机会股票和 mock 评分列表已隐藏。</p>
      </section>
    </div>
  );
}

function getDashboardSummary(holdings: DashboardHolding[]) {
  const pricedHoldings = holdings.filter((holding) => typeof holding.marketValue === "number" && Number.isFinite(holding.marketValue));
  const totalMarketValue = pricedHoldings.reduce((sum, holding) => sum + (holding.marketValue ?? 0), 0);
  const todayChangeValue = pricedHoldings.reduce((sum, holding) => sum + holding.shares * (holding.quote?.change ?? 0), 0);
  const totalPreviousValue = totalMarketValue - todayChangeValue;
  const todayChangePercent = totalPreviousValue > 0 ? (todayChangeValue / totalPreviousValue) * 100 : null;
  const largest = pricedHoldings
    .map((holding) => ({
      ticker: holding.ticker,
      currentPrice: holding.currentPrice ?? null,
      marketValue: holding.marketValue ?? 0,
      allocation: totalMarketValue > 0 ? ((holding.marketValue ?? 0) / totalMarketValue) * 100 : 0
    }))
    .sort((a, b) => b.marketValue - a.marketValue)[0] ?? null;

  const unavailableCount = holdings.filter((holding) => holding.quote?.source === "unavailable" || holding.currentPrice === null).length;
  const staleCount = holdings.filter((holding) => holding.quote?.source === "stale-cache" || holding.quote?.isStale).length;

  return {
    totalMarketValue,
    todayChangeValue: pricedHoldings.length ? todayChangeValue : null,
    todayChangePercent,
    largestHolding: largest,
    dataStatus: holdings.length === 0 ? "暂无持仓" : unavailableCount === holdings.length ? "暂无行情" : unavailableCount > 0 || staleCount > 0 ? "部分可用" : "已连接",
    riskLevel: !largest ? "暂无数据" : largest.allocation >= 35 ? "偏高" : "正常",
    riskNote: !largest ? "添加持仓后显示集中度" : largest.allocation >= 35 ? "最大持仓占比较高，请复核仓位纪律" : "最大持仓占比在可观察范围内"
  };
}

function LoadingState({ message }: { message: string }) {
  return <p className="rounded-md border border-line bg-panel px-3 py-8 text-center text-sm text-muted">{message}</p>;
}

function formatNullableCurrency(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? formatCurrency(value) : "--";
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
}

function formatNullableSignedCurrency(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "--";
  const formatted = formatCurrency(Math.abs(value));
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `-${formatted}`;
  return formatted;
}

function formatNullablePercent(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? formatPercent(value) : "--";
}

function formatPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 }).format(value);
}

function getGainLossClass(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "text-muted";
  if (value > 0) return "text-green-600";
  if (value < 0) return "text-red-600";
  return "text-muted";
}

function getV2RatingLabel(rating: string) {
  if (rating === "Strong Buy") return "Strong Buy / 强烈买入观察";
  if (rating === "Buy") return "Buy / 买入观察";
  if (rating === "Hold") return "Hold / 持有观察";
  if (rating === "Watch") return "Watch / 谨慎观察";
  if (rating === "Avoid") return "Avoid / 回避";
  return rating;
}
