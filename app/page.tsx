"use client";

import { useEffect, useMemo, useState } from "react";
import { DataSourceBadge } from "@/components/data-source-badge";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import type { MarketEvent } from "@/lib/events/types";
import type { MarketQuote } from "@/lib/market-data";
import type { Holding } from "@/lib/types";
import type { WatchlistRecord } from "@/lib/watchlist";

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
  marketQuote?: MarketQuote;
};

type DecisionStatus = "分批买入" | "等待回调" | "继续持有" | "考虑减仓" | "风险较高" | "数据不足";

type DecisionCard = {
  ticker: string;
  status: DecisionStatus;
  holding: DashboardHolding;
  watch?: WatchlistRecord;
  score?: AiScoreSummary;
  buyReason: string;
  riskReason: string;
  buyRange: string;
  riskControl: number | null;
  targetRange: string;
  earningsDate: string | null;
  confidence: string;
};

export default function DashboardPage() {
  const [holdings, setHoldings] = useState<DashboardHolding[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistRecord[]>([]);
  const [scores, setScores] = useState<AiScoreSummary[]>([]);
  const [events, setEvents] = useState<MarketEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const [holdingsPayload, watchlistPayload] = await Promise.all([
          fetchJson("/api/holdings"),
          fetchJson("/api/watchlist")
        ]);
        if (cancelled) return;

        const nextHoldings = readArrayPayload<DashboardHolding>(holdingsPayload);
        const nextWatchlist = readArrayPayload<WatchlistRecord>(watchlistPayload);
        setHoldings(nextHoldings);
        setWatchlist(nextWatchlist);

        const tickers = Array.from(new Set([...nextHoldings.map((item) => item.ticker), ...nextWatchlist.map((item) => item.ticker)].map((ticker) => ticker.trim().toUpperCase()).filter(Boolean)));
        const holdingTickers = Array.from(new Set(nextHoldings.map((item) => item.ticker.trim().toUpperCase()).filter(Boolean)));

        const [scoresPayload, eventsPayload] = await Promise.all([
          tickers.length ? fetchJson(`/api/ai-score/batch?tickers=${encodeURIComponent(tickers.join(","))}`) : Promise.resolve({ results: [] }),
          holdingTickers.length ? fetchJson(`/api/events?${getSevenDayEventParams(holdingTickers)}`) : Promise.resolve({ data: [] })
        ]);
        if (cancelled) return;
        setScores(Array.isArray(scoresPayload?.results) ? scoresPayload.results : []);
        setEvents(readArrayPayload<MarketEvent>(eventsPayload));
      } catch {
        if (!cancelled) {
          setError("暂无可靠结论。请确认已解锁并稍后刷新。");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const summary = useMemo(() => buildSummary(holdings), [holdings]);
  const decisions = useMemo(() => buildDecisionCards(holdings, watchlist, scores, events), [holdings, watchlist, scores, events]);
  const attentionItems = useMemo(() => buildAttentionItems(summary, decisions, events), [summary, decisions, events]);
  const largestHoldings = useMemo(() => [...holdings].sort((a, b) => (b.marketValue ?? 0) - (a.marketValue ?? 0)).slice(0, 3), [holdings]);
  const highRiskHoldings = useMemo(() => decisions.filter((item) => item.status === "风险较高").slice(0, 3), [decisions]);
  const closestBuy = useMemo(() => findClosestBuy(watchlist, scores), [watchlist, scores]);
  const closestExit = useMemo(() => findClosestExit(decisions), [decisions]);
  const lastUpdatedAt = useMemo(() => findLastUpdated(holdings, scores, events), [holdings, scores, events]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="今日投资决策"
        eyebrow="StockRadar AI"
        description="只回答三个问题：我持有什么、每只股票该怎么处理、哪些变化需要行动。"
      />

      {error ? <Notice>{error}</Notice> : null}

      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink">今日最需要关注的3件事</h2>
            <p className="mt-1 text-sm text-muted">按持仓风险、价格接近计划、未来事件排序。</p>
          </div>
          <p className="text-sm text-muted">数据更新时间：{lastUpdatedAt ? formatDateTime(lastUpdatedAt) : "暂无可靠结论"}</p>
        </div>
        {isLoading ? <LoadingState /> : attentionItems.length ? (
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {attentionItems.slice(0, 3).map((item) => (
              <article key={item.title} className="rounded-md border border-line bg-panel p-4">
                <p className="text-sm font-semibold text-ink">{item.title}</p>
                <p className="mt-2 text-sm text-muted">{item.detail}</p>
              </article>
            ))}
          </div>
        ) : <EmptyState />}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard label="持仓总市值" value={isLoading ? "--" : formatCurrencyOrDash(summary.totalMarketValue)} detail={`浮盈亏 ${formatSignedCurrencyOrDash(summary.unrealizedPL)} / ${formatPercentOrDash(summary.unrealizedPLPercent)}`} tone="green" />
        <MetricCard label="持仓数量" value={isLoading ? "--" : holdings.length} detail={holdings.length ? "基于当前真实持仓" : "暂无可靠结论"} tone="blue" />
        <MetricCard label="组合风险" value={isLoading ? "--" : summary.riskLabel} detail={summary.riskDetail} tone={summary.riskLabel === "风险偏高" ? "red" : summary.riskLabel === "暂无可靠结论" ? "neutral" : "green"} />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Panel title="仓位最大的3只股票">
          {isLoading ? <LoadingState /> : largestHoldings.length ? (
            <div className="grid gap-3">
              {largestHoldings.map((holding) => (
                <CompactHolding key={holding.id} holding={holding} />
              ))}
            </div>
          ) : <EmptyState />}
        </Panel>

        <Panel title="风险最高的持仓">
          {isLoading ? <LoadingState /> : highRiskHoldings.length ? (
            <div className="grid gap-3">
              {highRiskHoldings.map((item) => (
                <DecisionSummary key={item.ticker} item={item} />
              ))}
            </div>
          ) : <EmptyState />}
        </Panel>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Panel title="当前最接近买入区的股票">
          {isLoading ? <LoadingState /> : closestBuy ? <PlanSignal signal={closestBuy} /> : <EmptyState />}
        </Panel>
        <Panel title="当前最接近减仓或止损条件的股票">
          {isLoading ? <LoadingState /> : closestExit ? <PlanSignal signal={closestExit} /> : <EmptyState />}
        </Panel>
      </section>

      <Panel title="未来7天持仓相关财报">
        {isLoading ? <LoadingState /> : events.filter((event) => event.type === "earnings" && event.symbol).length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {events.filter((event) => event.type === "earnings" && event.symbol).slice(0, 6).map((event) => (
              <article key={event.id} className="rounded-md border border-line bg-panel p-4">
                <p className="font-semibold text-ink">{event.symbol} · {event.title}</p>
                <p className="mt-1 text-sm text-muted">{formatDate(event.startAt)} · {event.dateStatus === "confirmed" ? "日期已确认" : "预计日期"}</p>
                <p className="mt-2 text-xs text-muted">{event.sourceName}</p>
              </article>
            ))}
          </div>
        ) : <EmptyState />}
      </Panel>

      <Panel title="每只股票决策卡片">
        {isLoading ? <LoadingState /> : decisions.length ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {decisions.map((item) => <StockDecisionCard key={item.ticker} item={item} />)}
          </div>
        ) : <EmptyState />}
      </Panel>
    </div>
  );
}

async function fetchJson(url: string) {
  const response = await fetch(url, { cache: "no-store" });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error ?? "request failed");
  return payload;
}

function buildSummary(holdings: DashboardHolding[]) {
  const priced = holdings.filter((holding) => isFiniteNumber(holding.marketValue));
  const totalMarketValue = priced.reduce((sum, holding) => sum + (holding.marketValue ?? 0), 0);
  const totalCost = priced.reduce((sum, holding) => sum + (holding.totalCost ?? holding.averageCost * holding.shares), 0);
  const unrealizedPL = priced.length ? totalMarketValue - totalCost : null;
  const unrealizedPLPercent = unrealizedPL !== null && totalCost > 0 ? (unrealizedPL / totalCost) * 100 : null;
  const largestAllocation = Math.max(0, ...priced.map((holding) => holding.allocation ?? 0));
  return {
    totalMarketValue: priced.length ? totalMarketValue : null,
    unrealizedPL,
    unrealizedPLPercent,
    riskLabel: holdings.length === 0 ? "暂无可靠结论" : largestAllocation >= 35 ? "风险偏高" : "可控",
    riskDetail: holdings.length === 0 ? "暂无持仓数据" : largestAllocation >= 35 ? "单一持仓集中度偏高" : "未发现明显集中度风险"
  };
}

function buildDecisionCards(holdings: DashboardHolding[], watchlist: WatchlistRecord[], scores: AiScoreSummary[], events: MarketEvent[]): DecisionCard[] {
  return holdings.map((holding) => {
    const ticker = holding.ticker.toUpperCase();
    const watch = watchlist.find((item) => item.ticker.toUpperCase() === ticker);
    const score = scores.find((item) => item.ticker.toUpperCase() === ticker);
    const earningsDate = events.find((event) => event.symbol === ticker && event.type === "earnings")?.startAt ?? null;
    const currentPrice = holding.currentPrice ?? null;
    const allocation = holding.allocation ?? 0;
    const riskControl = currentPrice ? roundMoney(watch?.targetBuyPrice ? watch.targetBuyPrice * 0.92 : holding.averageCost * 0.85) : null;
    const targetSell = watch?.targetSellPrice ?? (currentPrice ? roundMoney(currentPrice * 1.2) : null);
    const targetRange = targetSell ? `${formatCurrency(targetSell)} - ${formatCurrency(targetSell * 1.12)}` : "暂无可靠结论";
    const buyRange = watch?.targetBuyPrice ? `${formatCurrency(watch.targetBuyPrice * 0.98)} - ${formatCurrency(watch.targetBuyPrice)}` : "暂无可靠结论";
    const status = decideStatus({ holding, watch, score, riskControl, targetSell });
    return {
      ticker,
      status,
      holding,
      watch,
      score,
      buyReason: getBuyReason(status, score, watch),
      riskReason: getRiskReason(status, holding, riskControl),
      buyRange,
      riskControl,
      targetRange,
      earningsDate,
      confidence: getConfidence(holding.quote, score)
    };
  });
}

function decideStatus({ holding, watch, score, riskControl, targetSell }: { holding: DashboardHolding; watch?: WatchlistRecord; score?: AiScoreSummary; riskControl: number | null; targetSell: number | null }): DecisionStatus {
  const price = holding.currentPrice ?? null;
  if (!isFiniteNumber(price)) return "数据不足";
  if ((holding.allocation ?? 0) >= 35 || (riskControl !== null && price <= riskControl)) return "风险较高";
  if (targetSell !== null && price >= targetSell) return "考虑减仓";
  if (watch?.targetBuyPrice && price <= watch.targetBuyPrice && (score?.score ?? 0) >= 65) return "分批买入";
  if (watch?.targetBuyPrice && price > watch.targetBuyPrice) return "等待回调";
  return "继续持有";
}

function buildAttentionItems(summary: ReturnType<typeof buildSummary>, decisions: DecisionCard[], events: MarketEvent[]) {
  const items: { title: string; detail: string }[] = [];
  const risk = decisions.find((item) => item.status === "风险较高");
  const trim = decisions.find((item) => item.status === "考虑减仓");
  const buy = decisions.find((item) => item.status === "分批买入");
  const earnings = events.find((event) => event.type === "earnings" && event.symbol);
  if (risk) items.push({ title: `${risk.ticker} 风险较高`, detail: risk.riskReason });
  if (trim) items.push({ title: `${trim.ticker} 接近减仓条件`, detail: `目标区间：${trim.targetRange}` });
  if (buy) items.push({ title: `${buy.ticker} 接近买入区`, detail: `买入区间：${buy.buyRange}` });
  if (earnings) items.push({ title: `${earnings.symbol} 财报临近`, detail: `${formatDate(earnings.startAt)} · ${earnings.dateStatus === "confirmed" ? "日期已确认" : "预计日期"}` });
  if (!items.length && summary.riskLabel !== "暂无可靠结论") items.push({ title: "组合暂无紧急动作", detail: "当前没有明确买入、减仓或财报行动信号。" });
  return items;
}

function findClosestBuy(watchlist: WatchlistRecord[], scores: AiScoreSummary[]) {
  return watchlist
    .map((item) => {
      const score = scores.find((entry) => entry.ticker.toUpperCase() === item.ticker.toUpperCase());
      if (!item.targetBuyPrice || !score?.price) return null;
      return {
        ticker: item.ticker,
        label: "接近买入区",
        price: score.price,
        target: item.targetBuyPrice,
        distance: Math.abs((score.price - item.targetBuyPrice) / item.targetBuyPrice) * 100,
        detail: item.watchReason ?? item.notes ?? "暂无可靠结论",
        quote: score.marketQuote
      };
    })
    .filter(Boolean)
    .sort((a, b) => a!.distance - b!.distance)[0] ?? null;
}

function findClosestExit(decisions: DecisionCard[]) {
  return decisions
    .flatMap((item) => {
      const price = item.holding.currentPrice;
      const signals = [];
      if (isFiniteNumber(price) && item.riskControl) {
        signals.push({ ticker: item.ticker, label: "接近风险控制价", price, target: item.riskControl, distance: Math.abs((price - item.riskControl) / item.riskControl) * 100, detail: item.riskReason, quote: item.holding.quote });
      }
      const target = item.watch?.targetSellPrice;
      if (isFiniteNumber(price) && target) {
        signals.push({ ticker: item.ticker, label: "接近减仓价", price, target, distance: Math.abs((price - target) / target) * 100, detail: `目标区间：${item.targetRange}`, quote: item.holding.quote });
      }
      return signals;
    })
    .sort((a, b) => a.distance - b.distance)[0] ?? null;
}

function StockDecisionCard({ item }: { item: DecisionCard }) {
  return (
    <article className="rounded-lg border border-line bg-panel p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-ink">{item.ticker}</h3>
          <p className="mt-1 text-sm text-muted">{item.holding.companyName ?? "暂无公司名称"}</p>
        </div>
        <span className={`rounded-md px-3 py-1 text-sm font-semibold ${getStatusClass(item.status)}`}>{item.status}</span>
      </div>
      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <Field label="当前价格" value={formatCurrencyOrDash(item.holding.currentPrice)} />
        <Field label="用户成本" value={formatCurrency(item.holding.averageCost)} />
        <Field label="当前仓位" value={formatPercentOrDash(item.holding.allocation)} />
        <Field label="财报日期" value={item.earningsDate ? formatDate(item.earningsDate) : "暂无可靠结论"} />
        <Field label="建议买入区间" value={item.buyRange} />
        <Field label="风险控制价" value={formatCurrencyOrDash(item.riskControl)} />
        <Field label="目标区间" value={item.targetRange} />
        <Field label="数据可信度" value={item.confidence} />
      </div>
      <div className="mt-4 grid gap-3 text-sm">
        <Reason label="买入理由" value={item.buyReason} />
        <Reason label="风险理由" value={item.riskReason} />
        <div>
          <p className="mb-1 text-xs font-semibold text-muted">数据来源</p>
          <DataSourceBadge quote={item.holding.quote ?? item.score?.marketQuote ?? null} />
        </div>
      </div>
    </article>
  );
}

function CompactHolding({ holding }: { holding: DashboardHolding }) {
  return (
    <article className="rounded-md border border-line bg-panel p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-ink">{holding.ticker}</p>
          <p className="text-sm text-muted">{formatCurrencyOrDash(holding.marketValue)} · {formatPercentOrDash(holding.allocation)}</p>
        </div>
        <DataSourceBadge quote={holding.quote ?? null} />
      </div>
    </article>
  );
}

function DecisionSummary({ item }: { item: DecisionCard }) {
  return (
    <article className="rounded-md border border-line bg-panel p-4">
      <p className="font-semibold text-ink">{item.ticker} · {item.status}</p>
      <p className="mt-1 text-sm text-muted">{item.riskReason}</p>
    </article>
  );
}

function PlanSignal({ signal }: { signal: NonNullable<ReturnType<typeof findClosestBuy>> | NonNullable<ReturnType<typeof findClosestExit>> }) {
  return (
    <article className="rounded-md border border-line bg-panel p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-ink">{signal.ticker} · {signal.label}</p>
          <p className="mt-1 text-sm text-muted">当前 {formatCurrency(signal.price)} / 条件 {formatCurrency(signal.target)} / 距离 {signal.distance.toFixed(2)}%</p>
          <p className="mt-2 text-sm text-muted">{signal.detail}</p>
        </div>
        <DataSourceBadge quote={signal.quote ?? null} />
      </div>
    </article>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
      <h2 className="mb-4 text-lg font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, value }: { label: string; value: string | number }) {
  return <div><p className="text-xs font-semibold text-muted">{label}</p><p className="mt-1 font-medium text-ink">{value}</p></div>;
}

function Reason({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border border-line bg-white p-3"><p className="text-xs font-semibold text-muted">{label}</p><p className="mt-1 text-ink">{value}</p></div>;
}

function Notice({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">{children}</p>;
}

function EmptyState() {
  return <p className="rounded-md border border-line bg-panel px-3 py-8 text-center text-sm text-muted">暂无可靠结论</p>;
}

function LoadingState() {
  return <p className="rounded-md border border-line bg-panel px-3 py-8 text-center text-sm text-muted">正在加载决策数据...</p>;
}

function getBuyReason(status: DecisionStatus, score?: AiScoreSummary, watch?: WatchlistRecord) {
  if (status === "分批买入") return watch?.watchReason ?? `评分 ${score?.score ?? "--"}，价格已进入计划买入区。`;
  if (status === "等待回调") return "标的仍在观察，但当前价格尚未进入计划买入区。";
  if (status === "继续持有") return score ? `评分 ${score.score}，当前没有触发减仓或止损条件。` : "当前没有触发减仓或止损条件。";
  return "暂无明确买入理由。";
}

function getRiskReason(status: DecisionStatus, holding: DashboardHolding, riskControl: number | null) {
  if (status === "风险较高") {
    if ((holding.allocation ?? 0) >= 35) return "单一持仓占比偏高，可能影响组合稳定性。";
    if (riskControl !== null) return `价格接近或跌破风险控制价 ${formatCurrency(riskControl)}。`;
  }
  if (!isFiniteNumber(holding.currentPrice)) return "行情数据不足，无法判断风险。";
  return "未发现明确风险触发，但仍需跟踪价格和财报变化。";
}

function getConfidence(quote?: MarketQuote, score?: AiScoreSummary) {
  if (!quote || quote.source === "unavailable") return "数据不足";
  if (quote.source === "stale-cache" || quote.isStale) return "过期缓存，可信度较低";
  if (quote.source === "cache") return "缓存数据，可信度中等";
  if (score) return "真实行情 + 规则评分";
  return "真实行情";
}

function getStatusClass(status: DecisionStatus) {
  if (status === "分批买入") return "bg-green-100 text-green-700";
  if (status === "等待回调") return "bg-blue-100 text-blue-700";
  if (status === "继续持有") return "bg-slate-100 text-slate-700";
  if (status === "考虑减仓") return "bg-amber-100 text-amber-800";
  if (status === "风险较高") return "bg-red-100 text-red-700";
  return "bg-slate-100 text-slate-500";
}

function readArrayPayload<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === "object" && Array.isArray((payload as { data?: unknown }).data)) return (payload as { data: T[] }).data;
  if (payload && typeof payload === "object" && Array.isArray((payload as { items?: unknown }).items)) return (payload as { items: T[] }).items;
  return [];
}

function getSevenDayEventParams(tickers: string[]) {
  const today = new Date();
  const end = new Date(today);
  end.setDate(today.getDate() + 7);
  const params = new URLSearchParams({ from: today.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10), symbols: tickers.join(","), types: "earnings" });
  return params.toString();
}

function findLastUpdated(holdings: DashboardHolding[], scores: AiScoreSummary[], events: MarketEvent[]) {
  return [
    ...holdings.map((item) => item.quote?.updatedAt ?? item.quote?.fetchedAt ?? null),
    ...scores.map((item) => item.marketQuote?.updatedAt ?? item.marketQuote?.fetchedAt ?? null),
    ...events.map((item) => item.updatedAt ?? item.fetchedAt ?? null)
  ].filter(Boolean).sort().at(-1) ?? null;
}

function formatCurrencyOrDash(value: number | null | undefined) {
  return isFiniteNumber(value) ? formatCurrency(value) : "--";
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
}

function formatSignedCurrencyOrDash(value: number | null | undefined) {
  if (!isFiniteNumber(value)) return "--";
  const abs = formatCurrency(Math.abs(value));
  return value > 0 ? `+${abs}` : value < 0 ? `-${abs}` : abs;
}

function formatPercentOrDash(value: number | null | undefined) {
  return isFiniteNumber(value) ? `${value >= 0 ? "+" : ""}${value.toFixed(2)}%` : "--";
}

function formatDate(value: string) {
  const date = value.slice(0, 10);
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date || "暂无可靠结论";
  return new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric", weekday: "short" }).format(parsed);
}

function formatDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "暂无可靠结论";
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(parsed);
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
