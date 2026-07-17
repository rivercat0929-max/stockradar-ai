"use client";

import { useState, type ReactNode } from "react";
import { DataSourceBadge } from "@/components/data-source-badge";
import { useLanguage } from "@/components/language-provider";
import type { MarketQuote } from "@/lib/market-data";
import { PageHeader } from "@/components/page-header";

type DataSource = "真实数据" | "真实数据计算" | "缓存数据" | "数据可能过期" | "暂无可靠数据";

type AiScoreResponse = {
  ticker: string;
  price: number | null;
  pe: number | null;
  eps: number | null;
  marketCap: number | null;
  changesPercentage: number | null;
  score: number | null;
  overallScore: number | null;
  dataCoverage: number;
  confidence: "high" | "medium" | "low" | "insufficient";
  rating: "Strong Buy" | "Buy" | "Hold" | "Watch" | "Avoid" | string;
  ratingLabel: string;
  dimensions: Array<{
    key: string;
    name: string;
    label?: string;
    score: number | null;
    weight: number;
    weightedScore: number;
    status?: string;
    source: string;
    updatedAt?: string | null;
    metricsUsed?: string[];
    missingMetrics?: string[];
    explanation?: string;
    reason?: string;
  }>;
  strengths: string[];
  risks: string[];
  investorProfile: string;
  aiSummary: string;
  dataSource: DataSource;
  dataSourceDetails: string[];
  assetType?: "stock" | "etf" | "fund" | "reit" | "index" | "unknown";
  scoreMode?: "real_data" | "insufficient" | "etf_limited";
  stale?: boolean;
  marketQuote: MarketQuote;
};

export default function AiScorePage() {
  const { t } = useLanguage();
  const [ticker, setTicker] = useState("TSLA");
  const [result, setResult] = useState<AiScoreResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function analyze(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedTicker = ticker.trim().toUpperCase();
    if (!normalizedTicker) {
      setError(t("tickerRequired"));
      setResult(null);
      return;
    }

    setTicker(normalizedTicker);
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/ai-score?ticker=${encodeURIComponent(normalizedTicker)}`, { cache: "no-store" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "评分暂不可用，请稍后重试");
      }

      setResult(data);
    } catch {
      setResult(null);
      setError("评分暂不可用，请稍后重试");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI 股票评分 V2"
        eyebrow="真实数据分析"
        description="基于真实行情、历史K线和 SEC 财务数据。数据不足时不生成综合评分。"
      />

      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <form onSubmit={analyze} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1 text-sm">
            <span className="font-medium text-ink">股票代码</span>
            <input
              value={ticker}
              onChange={(event) => setTicker(event.target.value.toUpperCase())}
              className="mt-1 w-full rounded-md border border-line bg-panel px-3 py-2 text-ink outline-none focus:border-signal"
              placeholder="TSLA"
            />
          </label>
          <button
            type="submit"
            disabled={isLoading}
            className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "分析中..." : "开始分析"}
          </button>
        </form>

        <div className="mt-4 flex flex-wrap gap-2">
          {["TSLA", "NVDA", "META", "AMZN", "AAPL", "MSFT", "SPY", "QQQ", "INVALIDTICKER"].map((sample) => (
            <button
              key={sample}
              type="button"
              onClick={() => setTicker(sample)}
              className="rounded-md border border-line bg-panel px-3 py-1 text-sm font-medium text-muted hover:border-signal hover:text-ink"
            >
              {sample}
            </button>
          ))}
        </div>

        {error ? <p className="mt-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      </section>

      {result ? (
        <>
          <section className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
            <div className="rounded-lg border border-line bg-white p-5 shadow-soft">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-muted">{result.ticker}</p>
                  <h2 className="mt-2 text-4xl font-bold tracking-normal text-ink">{result.score === null ? "暂不生成评分" : `AI Score ${result.score}/100`}</h2>
                </div>
                <SourceBadge source={result.dataSource} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className={`rounded-md px-3 py-1 text-sm font-semibold ${getRatingClass(result.rating)}`}>{result.rating} / {result.ratingLabel}</span>
                <span className="rounded-md bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-700">覆盖率 {(result.dataCoverage * 100).toFixed(0)}%</span>
                <span className="rounded-md bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">可信度 {result.confidence}</span>
                {result.scoreMode === "etf_limited" ? <span className="rounded-md bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">ETF有限模型</span> : null}
                {result.assetType === "etf" || result.assetType === "fund" ? <span className="rounded-md bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">ETF/基金</span> : null}
                {result.stale ? <span className="rounded-md bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800">使用缓存数据</span> : null}
              </div>
              <p className="mt-4 rounded-md border border-line bg-panel p-4 text-sm leading-6 text-muted">{result.aiSummary}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <Metric label="当前价格" value={formatNullableCurrency(result.price)} extra={<DataSourceBadge quote={result.marketQuote} />} />
              <Metric label="PE" value={formatOptionalNumber(result.pe)} />
              <Metric label="EPS" value={formatOptionalNumber(result.eps)} />
              <Metric label="市值" value={formatMarketCap(result.marketCap)} />
              <Metric label="涨跌幅" value={formatNullablePercent(result.changesPercentage)} tone={(result.changesPercentage ?? 0) >= 0 ? "gain" : "loss"} />
            </div>
          </section>

          <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-ink">五维真实评分</h2>
                <p className="mt-1 text-sm text-muted">趋势20%、成长25%、估值20%、盈利质量20%、风险15%。情绪暂无可靠数据，不参与评分。</p>
              </div>
              <span className="text-sm font-semibold text-muted">{result.score === null ? "数据不足，暂不生成综合评分" : `加权总分 ${result.score}/100`}</span>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {result.dimensions.map((item) => (
                <DimensionBar key={item.key} item={item} />
              ))}
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <InsightList title="优势" items={result.strengths} tone="positive" />
            <InsightList title="风险" items={result.risks} tone="risk" />
          </section>

          <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
            <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
              <h2 className="text-lg font-semibold text-ink">适合投资者类型</h2>
              <p className="mt-4 rounded-md border border-line bg-panel p-4 text-sm leading-6 text-muted">{result.investorProfile}</p>
            </section>
            <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
              <h2 className="text-lg font-semibold text-ink">数据来源标签</h2>
              <div className="mt-4 space-y-2">
                {result.dataSourceDetails.map((detail) => (
                  <p key={detail} className="rounded-md border border-line bg-panel px-3 py-2 text-sm text-muted">{detail}</p>
                ))}
              </div>
            </section>
          </section>

          <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
            <h2 className="text-lg font-semibold text-ink">AI投资报告</h2>
            <div className="mt-4 space-y-4 text-sm leading-6 text-muted">
              <p>{result.aiSummary}</p>
              <p>评分越高代表当前数据下的综合观察价值越强，但不代表一定上涨。请结合仓位、行业集中度、财报事件和个人风险承受能力独立判断。</p>
              {result.assetType === "etf" || result.assetType === "fund" ? <p>ETF/基金不套用单公司营收、EPS 和盈利质量模型；基础数据不足时不生成完整股票评分。</p> : null}
            </div>
          </section>
        </>
      ) : null}

      <p className="text-xs text-muted">本评分仅用于投资教育和研究，不构成财务建议。</p>
    </div>
  );
}

function Metric({ label, value, tone = "neutral", extra }: { label: string; value: string; tone?: "neutral" | "gain" | "loss"; extra?: ReactNode }) {
  const toneClass = tone === "gain" ? "text-green-600" : tone === "loss" ? "text-red-600" : "text-ink";

  return (
    <div className="rounded-lg border border-line bg-white p-4 shadow-soft">
      <p className="text-sm text-muted">{label}</p>
      <p className={`mt-2 text-lg font-semibold ${toneClass}`}>{value}</p>
      {extra ? <div className="mt-2">{extra}</div> : null}
    </div>
  );
}

function DimensionBar({ item }: { item: AiScoreResponse["dimensions"][number] }) {
  const score = item.score;
  const label = item.label ?? item.name;
  return (
    <div className="rounded-md border border-line bg-panel p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-ink">{label}</p>
          <p className="mt-1 text-xs text-muted">权重 {(item.weight * 100).toFixed(0)}% · 状态 {getStatusLabel(item.status)}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={item.status} />
          <span className="text-sm font-semibold text-signal">{score === null ? "暂无可靠数据" : `${score}/100`}</span>
        </div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded bg-white">
        <div className={`h-full rounded ${score === null ? "bg-slate-200" : getScoreBarClass(score)}`} style={{ width: `${score === null ? 0 : Math.min(100, score)}%` }} />
      </div>
      <p className="mt-3 text-sm text-muted">{item.explanation ?? item.reason}</p>
      {item.metricsUsed?.length ? <p className="mt-2 text-xs text-muted">使用指标：{item.metricsUsed.join("、")}</p> : null}
      {item.missingMetrics?.length ? <p className="mt-1 text-xs text-muted">缺失指标：{item.missingMetrics.join("、")}</p> : null}
      <p className="mt-1 text-xs text-muted">来源：{item.source}{item.updatedAt ? ` · 更新 ${formatDateTime(item.updatedAt)}` : ""}</p>
    </div>
  );
}

function InsightList({ title, items, tone }: { title: string; items: string[]; tone: "positive" | "risk" }) {
  return (
    <div className="rounded-lg border border-line bg-white p-5 shadow-soft">
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      <ul className="mt-4 space-y-2">
        {items.map((item) => (
          <li key={item} className={`rounded-md border px-3 py-2 text-sm ${tone === "positive" ? "border-green-200 bg-green-50 text-green-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SourceBadge({ source }: { source: DataSource }) {
  return <span className={`rounded-md px-2 py-1 text-xs font-semibold ${getSourceClass(source)}`}>{source}</span>;
}

function StatusBadge({ status }: { status?: string }) {
  const label = getStatusLabel(status);
  return <span className={`rounded-md px-2 py-1 text-xs font-semibold ${getStatusClass(status)}`}>{label}</span>;
}

function getStatusLabel(status?: string) {
  if (status === "real") return "真实数据";
  if (status === "calculated") return "真实数据计算";
  if (status === "cache") return "缓存数据";
  if (status === "stale-cache") return "数据可能过期";
  return "暂无可靠数据";
}

function getStatusClass(status?: string) {
  if (status === "real" || status === "calculated") return "bg-green-100 text-green-700";
  if (status === "cache") return "bg-blue-100 text-blue-700";
  if (status === "stale-cache") return "bg-amber-100 text-amber-800";
  return "bg-slate-100 text-slate-600";
}

function getSourceClass(source: DataSource) {
  if (source === "真实数据" || source === "真实数据计算") return "bg-green-100 text-green-700";
  if (source === "缓存数据") return "bg-amber-100 text-amber-800";
  if (source === "数据可能过期") return "bg-amber-100 text-amber-800";
  return "bg-slate-100 text-slate-600";
}

function getScoreBarClass(score: number) {
  if (score >= 80) return "bg-green-500";
  if (score >= 65) return "bg-blue-500";
  if (score >= 50) return "bg-amber-500";
  return "bg-red-500";
}

function getRatingClass(rating: string) {
  if (rating === "Strong Buy") return "bg-green-100 text-green-700";
  if (rating === "Buy") return "bg-blue-100 text-blue-700";
  if (rating === "Hold") return "bg-slate-100 text-slate-700";
  if (rating === "Watch") return "bg-amber-100 text-amber-800";
  return "bg-red-100 text-red-700";
}

function formatNullableCurrency(value: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? formatCurrency(value) : "--";
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
}

function formatOptionalNumber(value: number | null) {
  if (value === null) return "--";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

function formatNullablePercent(value: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? formatPercent(value) : "--";
}

function formatPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatMarketCap(value: number | null) {
  if (value === null) return "--";
  if (value >= 1_000_000_000_000) return `$${formatOptionalNumber(value / 1_000_000_000_000)}T`;
  if (value >= 1_000_000_000) return `$${formatOptionalNumber(value / 1_000_000_000)}B`;
  return `$${formatOptionalNumber(value / 1_000_000)}M`;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未知时间";
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(date);
}



