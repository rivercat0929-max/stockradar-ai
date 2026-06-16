"use client";

import { useState } from "react";
import { useLanguage } from "@/components/language-provider";
import { PageHeader } from "@/components/page-header";

type AiScoreResponse = {
  ticker: string;
  price: number;
  pe: number | null;
  eps: number | null;
  marketCap: number | null;
  changesPercentage: number;
  score: number;
  rating: string;
  breakdown: Array<{
    name: string;
    score: number;
    max: number;
    reason: string;
  }>;
  strengths: string[];
  risks: string[];
  assetType?: "ETF";
  scoreMode?: "full" | "market_only";
  stale?: boolean;
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
        throw new Error(data.error ?? t("aiScoreAnalyzeError"));
      }

      setResult(data);
    } catch (analyzeError) {
      setResult(null);
      setError(analyzeError instanceof Error ? localizeAiScoreError(analyzeError.message, t) : t("aiScoreAnalyzeError"));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("aiScorePageTitle")}
        eyebrow={t("aiScore")}
        description={t("aiScorePageDescription")}
      />

      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <form onSubmit={analyze} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1 text-sm">
            <span className="font-medium text-ink">{t("ticker")}</span>
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
            {isLoading ? t("analyzing") : t("analyze")}
          </button>
        </form>

        <div className="mt-4 flex flex-wrap gap-2">
          {["TSLA", "NVDA", "AMZN", "CEG"].map((sample) => (
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
        {result?.stale ? <p className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">{t("usingCachedData")}</p> : null}
      </section>

      {result ? (
        <>
          <section className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="rounded-lg border border-line bg-white p-5 shadow-soft">
              <p className="text-sm font-medium text-muted">{result.ticker}</p>
              <h2 className="mt-2 text-4xl font-bold tracking-normal text-ink">{t("aiScore")} {result.score}/100</h2>
              <p className="mt-3 inline-flex rounded-md bg-panel px-3 py-1 text-sm font-semibold text-signal">{getLocalizedRating(result.score, t)}</p>
              <ScoreModeNotes result={result} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <Metric label={t("currentPrice")} value={formatCurrency(result.price)} />
              <Metric label="PE" value={formatOptionalNumber(result.pe)} />
              <Metric label="EPS" value={formatOptionalNumber(result.eps)} />
              <Metric label={t("marketCap")} value={formatMarketCap(result.marketCap)} />
              <Metric label={t("changePercent")} value={formatPercent(result.changesPercentage)} tone={result.changesPercentage >= 0 ? "gain" : "loss"} />
            </div>
          </section>

          <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
            <h2 className="text-lg font-semibold text-ink">{t("breakdown")}</h2>
            <div className="mt-4 space-y-3">
              {result.breakdown.map((item) => (
                <div key={item.name} className="rounded-md border border-line bg-panel p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-semibold text-ink">{item.name}</p>
                    <p className="text-sm font-semibold text-signal">
                      {item.score}/{item.max}
                    </p>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded bg-white">
                    <div className="h-full rounded bg-signal" style={{ width: `${Math.min(100, (item.score / item.max) * 100)}%` }} />
                  </div>
                  <p className="mt-3 text-sm text-muted">{item.reason}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <InsightList title={t("strengths")} items={result.strengths} />
            <InsightList title={t("risks")} items={result.risks} />
          </section>
        </>
      ) : null}

      <p className="text-xs text-muted">{t("aiScoreEducationDisclaimer")}</p>
    </div>
  );
}

function Metric({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "gain" | "loss" }) {
  const toneClass = tone === "gain" ? "text-green-600" : tone === "loss" ? "text-red-600" : "text-ink";

  return (
    <div className="rounded-lg border border-line bg-white p-4 shadow-soft">
      <p className="text-sm text-muted">{label}</p>
      <p className={`mt-2 text-lg font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

function InsightList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg border border-line bg-white p-5 shadow-soft">
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      <ul className="mt-4 space-y-2">
        {items.map((item) => (
          <li key={item} className="rounded-md border border-line bg-panel px-3 py-2 text-sm text-muted">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ScoreModeNotes({ result }: { result: AiScoreResponse }) {
  const { t } = useLanguage();

  if (result.scoreMode !== "market_only" && result.assetType !== "ETF") return null;

  return (
    <div className="mt-3 space-y-1 text-sm text-muted">
      {result.scoreMode === "market_only" ? <p>{t("marketOnlyScore")}</p> : null}
      {result.assetType === "ETF" ? <p>{t("etfDataNotice")}</p> : null}
    </div>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
}

function formatOptionalNumber(value: number | null) {
  if (value === null) return "-";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

function formatPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatMarketCap(value: number | null) {
  if (value === null) return "-";
  if (value >= 1_000_000_000_000) return `$${formatOptionalNumber(value / 1_000_000_000_000)}T`;
  if (value >= 1_000_000_000) return `$${formatOptionalNumber(value / 1_000_000_000)}B`;
  return `$${formatOptionalNumber(value / 1_000_000)}M`;
}

function localizeAiScoreError(message: string, t: ReturnType<typeof useLanguage>["t"]) {
  if (message.includes("FMP_API_KEY")) return t("aiScoreApiKeyMissing");
  return t("aiScoreAnalyzeError");
}

function getLocalizedRating(score: number, t: ReturnType<typeof useLanguage>["t"]) {
  if (score >= 80) return t("strongWatch");
  if (score >= 65) return t("watch");
  if (score >= 50) return t("neutral");
  return t("highRisk");
}
