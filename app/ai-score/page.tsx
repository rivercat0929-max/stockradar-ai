"use client";

import { useState, type ReactNode } from "react";
import { DataSourceBadge } from "@/components/data-source-badge";
import { useLanguage } from "@/components/language-provider";
import type { MarketQuote } from "@/lib/market-data";
import { PageHeader } from "@/components/page-header";

type DataSource = "çœŸå®žæ•°æ®" | "ç¼“å­˜æ•°æ®" | "ä¼°ç®—æ•°æ®" | "ç¤ºä¾‹æ•°æ®";

type AiScoreResponse = {
  ticker: string;
  price: number | null;
  pe: number | null;
  eps: number | null;
  marketCap: number | null;
  changesPercentage: number | null;
  score: number;
  rating: "Strong Buy" | "Buy" | "Hold" | "Watch" | "Avoid" | string;
  ratingLabel: string;
  dimensions: Array<{
    key: string;
    name: string;
    score: number;
    weight: number;
    weightedScore: number;
    source: DataSource;
    reason: string;
  }>;
  strengths: string[];
  risks: string[];
  investorProfile: string;
  aiSummary: string;
  dataSource: DataSource;
  dataSourceDetails: string[];
  assetType?: "ETF";
  scoreMode?: "full" | "market_only" | "estimated";
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
        throw new Error(data.error ?? "è¯„åˆ†æš‚ä¸å¯ç”¨ï¼Œè¯·ç¨åŽé‡è¯•");
      }

      setResult(data);
    } catch {
      setResult(null);
      setError("è¯„åˆ†æš‚ä¸å¯ç”¨ï¼Œè¯·ç¨åŽé‡è¯•");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI è‚¡ç¥¨è¯„åˆ† V2"
        eyebrow="å…­ç»´æŠ•èµ„è¯„åˆ†æŠ¥å‘Š"
        description="åŸºäºŽè¶‹åŠ¿ã€æˆé•¿ã€ä¼°å€¼ã€ç›ˆåˆ©ã€æƒ…ç»ªå’Œé£Žé™©å…­ä¸ªç»´åº¦ç”ŸæˆæŠ•èµ„ç ”ç©¶è¯„åˆ†ã€‚"
      />

      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <form onSubmit={analyze} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1 text-sm">
            <span className="font-medium text-ink">è‚¡ç¥¨ä»£ç </span>
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
            {isLoading ? "åˆ†æžä¸­..." : "å¼€å§‹åˆ†æž"}
          </button>
        </form>

        <div className="mt-4 flex flex-wrap gap-2">
          {["TSLA", "NVDA", "AMZN", "CEG", "TQQQ", "TSLL"].map((sample) => (
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
                  <h2 className="mt-2 text-4xl font-bold tracking-normal text-ink">AI Score {result.score}/100</h2>
                </div>
                <SourceBadge source={result.dataSource} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className={`rounded-md px-3 py-1 text-sm font-semibold ${getRatingClass(result.rating)}`}>{result.rating} / {result.ratingLabel}</span>
                {result.scoreMode === "market_only" ? <span className="rounded-md bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-700">å¸‚åœºèµ°åŠ¿è¯„åˆ†</span> : null}
                {result.scoreMode === "estimated" ? <span className="rounded-md bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800">å«ä¼°ç®—ç»´åº¦</span> : null}
                {result.assetType === "ETF" ? <span className="rounded-md bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">ETF/åŸºé‡‘</span> : null}
                {result.stale ? <span className="rounded-md bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800">ä½¿ç”¨ç¼“å­˜æ•°æ®</span> : null}
              </div>
              <p className="mt-4 rounded-md border border-line bg-panel p-4 text-sm leading-6 text-muted">{result.aiSummary}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <Metric label="å½“å‰ä»·æ ¼" value={formatNullableCurrency(result.price)} extra={<DataSourceBadge quote={result.marketQuote} />} />
              <Metric label="PE" value={formatOptionalNumber(result.pe)} />
              <Metric label="EPS" value={formatOptionalNumber(result.eps)} />
              <Metric label="å¸‚å€¼" value={formatMarketCap(result.marketCap)} />
              <Metric label="æ¶¨è·Œå¹…" value={formatNullablePercent(result.changesPercentage)} tone={(result.changesPercentage ?? 0) >= 0 ? "gain" : "loss"} />
            </div>
          </section>

          <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-ink">å…­ç»´è¯„åˆ†</h2>
                <p className="mt-1 text-sm text-muted">è¶‹åŠ¿20%ã€æˆé•¿20%ã€ä¼°å€¼15%ã€ç›ˆåˆ©15%ã€æƒ…ç»ª15%ã€é£Žé™©15%ã€‚</p>
              </div>
              <span className="text-sm font-semibold text-muted">åŠ æƒæ€»åˆ† {result.score}/100</span>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {result.dimensions.map((item) => (
                <DimensionBar key={item.key} item={item} />
              ))}
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <InsightList title="ä¼˜åŠ¿" items={result.strengths} tone="positive" />
            <InsightList title="é£Žé™©" items={result.risks} tone="risk" />
          </section>

          <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
            <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
              <h2 className="text-lg font-semibold text-ink">é€‚åˆæŠ•èµ„è€…ç±»åž‹</h2>
              <p className="mt-4 rounded-md border border-line bg-panel p-4 text-sm leading-6 text-muted">{result.investorProfile}</p>
            </section>
            <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
              <h2 className="text-lg font-semibold text-ink">æ•°æ®æ¥æºæ ‡ç­¾</h2>
              <div className="mt-4 space-y-2">
                {result.dataSourceDetails.map((detail) => (
                  <p key={detail} className="rounded-md border border-line bg-panel px-3 py-2 text-sm text-muted">{detail}</p>
                ))}
              </div>
            </section>
          </section>

          <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
            <h2 className="text-lg font-semibold text-ink">AIæŠ•èµ„æŠ¥å‘Š</h2>
            <div className="mt-4 space-y-4 text-sm leading-6 text-muted">
              <p>{result.aiSummary}</p>
              <p>è¯„åˆ†è¶Šé«˜ä»£è¡¨å½“å‰æ•°æ®ä¸‹çš„ç»¼åˆè§‚å¯Ÿä»·å€¼è¶Šå¼ºï¼Œä½†ä¸ä»£è¡¨ä¸€å®šä¸Šæ¶¨ã€‚è¯·ç»“åˆä»“ä½ã€è¡Œä¸šé›†ä¸­åº¦ã€è´¢æŠ¥äº‹ä»¶å’Œä¸ªäººé£Žé™©æ‰¿å—èƒ½åŠ›ç‹¬ç«‹åˆ¤æ–­ã€‚</p>
              {result.assetType === "ETF" ? <p>ETF/åŸºé‡‘å¯èƒ½æ²¡æœ‰ PE æˆ– EPSï¼Œå› æ­¤æˆé•¿ã€ä¼°å€¼ã€ç›ˆåˆ©ç»´åº¦åŒ…å«è§„åˆ™ä¼°ç®—ï¼Œé€‚åˆç”¨ä½œèµ°åŠ¿é›·è¾¾ï¼Œä¸é€‚åˆä½œä¸ºåŸºæœ¬é¢ç»“è®ºã€‚</p> : null}
            </div>
          </section>
        </>
      ) : null}

      <p className="text-xs text-muted">æœ¬è¯„åˆ†ä»…ç”¨äºŽæŠ•èµ„æ•™è‚²å’Œç ”ç©¶ï¼Œä¸æž„æˆè´¢åŠ¡å»ºè®®ã€‚</p>
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
  return (
    <div className="rounded-md border border-line bg-panel p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-ink">{item.name}</p>
          <p className="mt-1 text-xs text-muted">æƒé‡ {item.weight}% Â· åŠ æƒ {item.weightedScore.toFixed(1)}</p>
        </div>
        <div className="flex items-center gap-2">
          <SourceBadge source={item.source} />
          <span className="text-sm font-semibold text-signal">{item.score}/100</span>
        </div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded bg-white">
        <div className={`h-full rounded ${getScoreBarClass(item.score)}`} style={{ width: `${Math.min(100, item.score)}%` }} />
      </div>
      <p className="mt-3 text-sm text-muted">{item.reason}</p>
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

function getSourceClass(source: DataSource) {
  if (source === "çœŸå®žæ•°æ®") return "bg-green-100 text-green-700";
  if (source === "ç¼“å­˜æ•°æ®") return "bg-amber-100 text-amber-800";
  if (source === "ä¼°ç®—æ•°æ®") return "bg-blue-100 text-blue-700";
  return "bg-purple-100 text-purple-700";
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


