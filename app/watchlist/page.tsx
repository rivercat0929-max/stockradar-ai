"use client";

import { useEffect, useMemo, useState } from "react";
import { DataSyncStatus, type DataSyncState } from "@/components/data-sync-status";
import { DataSourceBadge } from "@/components/data-source-badge";
import { LocalStorageMigrationCard } from "@/components/local-storage-migration-card";
import { PageHeader } from "@/components/page-header";
import type { PortfolioAccount } from "@/lib/types";
import type { TradePlan } from "@/lib/trade-plans";
import { watchlistGroups, type EnrichedWatchlistItem, type WatchlistGroup, type WatchlistStatus } from "@/lib/watchlist";

type LoadState = "loading" | "loaded-empty" | "loaded-data" | "error";
type SortMode = "buy_zone_distance" | "research" | "coverage" | "earnings" | "created";

type FormState = {
  ticker: string;
  companyName: string;
  group: WatchlistGroup;
  buyZoneLow: string;
  buyZoneHigh: string;
  addPrice1: string;
  riskControlPrice: string;
  targetSellPrice: string;
  maxPositionWeight: string;
  thesis: string;
  invalidationConditions: string;
  watchReason: string;
  notes: string;
};

const allGroups = "全部";
const groupFilters: Array<typeof allGroups | WatchlistGroup> = [allGroups, ...watchlistGroups];
const emptyForm: FormState = {
  ticker: "",
  companyName: "",
  group: "重点观察",
  buyZoneLow: "",
  buyZoneHigh: "",
  addPrice1: "",
  riskControlPrice: "",
  targetSellPrice: "",
  maxPositionWeight: "",
  thesis: "",
  invalidationConditions: "",
  watchReason: "",
  notes: ""
};

const statusLabels: Record<WatchlistStatus, string> = {
  high_priority: "重点观察",
  wait_for_pullback: "等待回调",
  earnings_watch: "财报观察",
  long_term_watch: "长期关注",
  buy_zone: "已进入买入区",
  abandoned: "停止关注",
  insufficient_data: "数据不足"
};

const researchLabels: Record<EnrichedWatchlistItem["researchJudgment"], string> = {
  positive: "偏积极",
  neutral_positive: "中性偏积极",
  neutral: "中性",
  cautious: "谨慎",
  high_risk: "风险较高",
  insufficient_data: "数据不足"
};

const actionLabels: Record<EnrichedWatchlistItem["actionStatus"], string> = {
  buy_in_batches: "分批买入",
  wait_for_pullback: "等待回调",
  hold: "继续持有",
  consider_reduce: "考虑减仓",
  high_risk: "风险较高",
  trigger_risk_control: "触发风险控制",
  plan_not_set: "尚未设置计划",
  insufficient_data: "数据不足"
};

export default function WatchlistPage() {
  const [items, setItems] = useState<EnrichedWatchlistItem[]>([]);
  const [plans, setPlans] = useState<Record<string, TradePlan>>({});
  const [accounts, setAccounts] = useState<PortfolioAccount[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [selectedGroup, setSelectedGroup] = useState<typeof allGroups | WatchlistGroup>(allGroups);
  const [sortMode, setSortMode] = useState<SortMode>("buy_zone_distance");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<DataSyncState>("syncing");

  useEffect(() => {
    void loadWatchlist();
  }, []);

  const isLoading = loadState === "loading";
  const summary = useMemo(() => ({
    total: items.length,
    buyZone: items.filter((item) => item.watchlistStatus === "buy_zone").length,
    pullback: items.filter((item) => item.watchlistStatus === "wait_for_pullback").length,
    earnings: items.filter((item) => item.watchlistStatus === "earnings_watch").length
  }), [items]);

  const filteredItems = useMemo(() => {
    const filtered = selectedGroup === allGroups ? items : items.filter((item) => item.group === selectedGroup);
    return [...filtered].sort((a, b) => compareItems(a, b, sortMode));
  }, [items, selectedGroup, sortMode]);

  async function loadWatchlist() {
    setLoadState("loading");
    setError(null);
    try {
      const [watchlistResponse, accountsResponse, plansResponse] = await Promise.all([
        fetch("/api/watchlist", { cache: "no-store" }),
        fetch("/api/accounts", { cache: "no-store" }),
        fetch("/api/trade-plans", { cache: "no-store" }).catch(() => null)
      ]);
      const watchlistData = await watchlistResponse.json();
      const accountsData = await accountsResponse.json();
      const plansData = await plansResponse?.json().catch(() => null);
      if (!watchlistResponse.ok) throw new Error(watchlistData.error ?? "自选股加载失败。");
      const nextItems = readArrayPayload<EnrichedWatchlistItem>(watchlistData, "items");
      setItems(nextItems);
      setAccounts(Array.isArray(accountsData) ? accountsData : []);
      setPlans(Object.fromEntries(readArrayPayload<TradePlan>(plansData).map((plan) => [plan.symbol, plan])));
      setLoadState(nextItems.length ? "loaded-data" : "loaded-empty");
      setSyncState("synced");
    } catch (loadError) {
      setItems([]);
      setError(loadError instanceof Error ? loadError.message : "自选股加载失败。");
      setLoadState("error");
      setSyncState("cloud-unavailable");
    }
  }

  async function saveWatchlistItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/watchlist", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId,
          ticker: form.ticker,
          companyName: form.companyName || null,
          group: form.group,
          targetBuyPrice: form.buyZoneHigh || form.buyZoneLow || null,
          targetSellPrice: form.targetSellPrice || null,
          watchReason: form.watchReason || null,
          notes: form.notes || null
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "自选股保存失败。");
      const savedItem = readObjectPayload<EnrichedWatchlistItem>(data);
      if (!savedItem) throw new Error("自选股保存失败。");
      const savedPlan = await saveTradePlan(savedItem.ticker);
      if (savedPlan) setPlans((current) => ({ ...current, [savedPlan.symbol]: savedPlan }));
      setForm(emptyForm);
      setEditingId(null);
      setMessage(editingId ? "已更新自选股。" : "已添加到自选股。");
      await loadWatchlist();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "自选股保存失败。");
      setSyncState("failed");
    } finally {
      setIsSaving(false);
    }
  }

  async function saveTradePlan(symbol: string) {
    const response = await fetch("/api/trade-plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        symbol,
        buyZoneLow: form.buyZoneLow || null,
        buyZoneHigh: form.buyZoneHigh || null,
        addPrice1: form.addPrice1 || null,
        riskControlPrice: form.riskControlPrice || null,
        targetPrice1: form.targetSellPrice || null,
        maxPositionWeight: form.maxPositionWeight || null,
        thesis: form.thesis || form.watchReason || null,
        invalidationConditions: form.invalidationConditions,
        notes: form.notes || null
      })
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.error ?? "买卖计划保存失败。");
    return readObjectPayload<TradePlan>(payload);
  }

  async function deleteItem(item: EnrichedWatchlistItem) {
    if (!window.confirm(`确定停止跟踪 ${item.ticker} 吗？`)) return;
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/watchlist", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error ?? "删除失败。");
      setMessage(`已从自选股移除 ${item.ticker}。`);
      await loadWatchlist();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "删除失败。");
    }
  }

  async function addToHoldings(item: EnrichedWatchlistItem) {
    const account = accounts[0];
    if (!account) {
      setError("没有可用账户，无法一键加入持仓。");
      return;
    }
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/holdings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: account.id,
          ticker: item.ticker,
          companyName: item.companyName,
          shares: 1,
          averageCost: item.currentPrice ?? item.buyZoneHigh ?? 0,
          notes: `来自自选股：${item.watchReason ?? item.notes ?? "一键加入"}`
        })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error ?? "加入持仓失败。");
      const remove = window.confirm(`${item.ticker} 已加入持仓。是否同时从自选股移除？原关注理由和买卖计划会保留。`);
      if (remove) await deleteItem(item);
      else setMessage(`${item.ticker} 已加入 ${account.name}，自选股记录已保留。`);
    } catch (holdingError) {
      setError(holdingError instanceof Error ? holdingError.message : "加入持仓失败。");
    }
  }

  function editItem(item: EnrichedWatchlistItem) {
    const plan = plans[item.ticker.toUpperCase()];
    setEditingId(item.id);
    setForm({
      ticker: item.ticker,
      companyName: item.companyName,
      group: item.group,
      buyZoneLow: (plan?.buyZoneLow ?? item.buyZoneLow)?.toString() ?? "",
      buyZoneHigh: (plan?.buyZoneHigh ?? item.buyZoneHigh)?.toString() ?? "",
      addPrice1: (plan?.addPrice1 ?? item.firstWatchPrice)?.toString() ?? "",
      riskControlPrice: (plan?.riskControlPrice ?? item.riskReferencePrice)?.toString() ?? "",
      targetSellPrice: (plan?.targetPrice1 ?? item.targetSellPrice)?.toString() ?? "",
      maxPositionWeight: (plan?.maxPositionWeight ?? item.maxPositionWeight)?.toString() ?? "",
      thesis: plan?.thesis ?? item.watchReason ?? "",
      invalidationConditions: plan?.invalidationConditions?.join("\n") ?? "",
      watchReason: item.watchReason ?? "",
      notes: item.notes ?? ""
    });
  }

  function setFormValue<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="自选股观察"
        eyebrow="买入机会雷达"
        description="只跟踪还没买但值得观察的股票：为什么关注、现在能不能买、需要等什么。"
        action={<button onClick={loadWatchlist} className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">刷新</button>}
      />

      <LocalStorageMigrationCard />
      <DataSyncStatus state={syncState} detail={syncState === "cloud-unavailable" ? "云端暂时不可用，本地备份不会被清空" : null} />
      {error ? <p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">{error}</p> : null}
      {message ? <p className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">{message}</p> : null}

      <section className="grid gap-4 md:grid-cols-4">
        <SummaryCard label="自选股数量" value={isLoading ? "--" : String(summary.total)} />
        <SummaryCard label="已进入买入区" value={isLoading ? "--" : String(summary.buyZone)} tone={summary.buyZone ? "gain" : "neutral"} />
        <SummaryCard label="等待回调" value={isLoading ? "--" : String(summary.pullback)} />
        <SummaryCard label="未来7天财报" value={isLoading ? "--" : String(summary.earnings)} tone={summary.earnings ? "warn" : "neutral"} />
      </section>

      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <form onSubmit={saveWatchlistItem} className="grid gap-4 lg:grid-cols-6">
          <Field label="股票代码"><input required value={form.ticker} onChange={(event) => setFormValue("ticker", event.target.value.toUpperCase())} className="input" placeholder="NVDA" /></Field>
          <Field label="公司名称"><input value={form.companyName} onChange={(event) => setFormValue("companyName", event.target.value)} className="input" placeholder="可自动识别" /></Field>
          <Field label="观察状态"><select value={form.group} onChange={(event) => setFormValue("group", event.target.value as WatchlistGroup)} className="input">{watchlistGroups.map((group) => <option key={group} value={group}>{group}</option>)}</select></Field>
          <Field label="买入区下限"><input type="number" min="0" step="0.01" value={form.buyZoneLow} onChange={(event) => setFormValue("buyZoneLow", event.target.value)} className="input" /></Field>
          <Field label="买入区上限"><input type="number" min="0" step="0.01" value={form.buyZoneHigh} onChange={(event) => setFormValue("buyZoneHigh", event.target.value)} className="input" /></Field>
          <div className="flex items-end gap-2">
            <button disabled={isSaving} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-400">{isSaving ? "保存中..." : editingId ? "更新" : "添加"}</button>
            {editingId ? <button type="button" onClick={() => { setEditingId(null); setForm(emptyForm); }} className="rounded-md border border-line px-4 py-2 text-sm font-semibold text-ink hover:bg-panel">取消</button> : null}
          </div>
          <Field label="第一关注价"><input type="number" min="0" step="0.01" value={form.addPrice1} onChange={(event) => setFormValue("addPrice1", event.target.value)} className="input" /></Field>
          <Field label="风险参考价"><input type="number" min="0" step="0.01" value={form.riskControlPrice} onChange={(event) => setFormValue("riskControlPrice", event.target.value)} className="input" /></Field>
          <Field label="目标卖出价（可选）"><input type="number" min="0" step="0.01" value={form.targetSellPrice} onChange={(event) => setFormValue("targetSellPrice", event.target.value)} className="input" /></Field>
          <Field label="最大计划仓位%"><input type="number" min="0" max="100" step="0.1" value={form.maxPositionWeight} onChange={(event) => setFormValue("maxPositionWeight", event.target.value)} className="input" /></Field>
          <Field label="关注理由"><input value={form.watchReason} onChange={(event) => setFormValue("watchReason", event.target.value)} className="input" placeholder="为什么值得观察" /></Field>
          <Field label="逻辑失效条件"><textarea value={form.invalidationConditions} onChange={(event) => setFormValue("invalidationConditions", event.target.value)} className="input min-h-20" placeholder="每行一条" /></Field>
          <Field label="投资逻辑"><input value={form.thesis} onChange={(event) => setFormValue("thesis", event.target.value)} className="input" /></Field>
          <Field label="备注"><input value={form.notes} onChange={(event) => setFormValue("notes", event.target.value)} className="input" /></Field>
        </form>
      </section>

      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {groupFilters.map((group) => <button key={group} onClick={() => setSelectedGroup(group)} className={`rounded-md border px-3 py-2 text-sm font-semibold ${selectedGroup === group ? "border-blue-500 bg-blue-50 text-blue-700" : "border-line bg-white text-muted hover:text-ink"}`}>{group}</button>)}
          </div>
          <label className="text-sm font-semibold text-muted">排序
            <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)} className="ml-2 rounded-md border border-line bg-white px-2 py-1">
              <option value="buy_zone_distance">最接近买入区</option>
              <option value="research">研究判断</option>
              <option value="coverage">数据覆盖率</option>
              <option value="earnings">财报日期</option>
              <option value="created">最近添加</option>
            </select>
          </label>
        </div>

        {loadState === "loading" ? <p className="rounded-md border border-line bg-panel p-4 text-sm text-muted">正在加载自选股...</p> : null}
        {loadState === "loaded-empty" ? <p className="rounded-md border border-line bg-panel px-3 py-10 text-center text-sm text-muted">暂无自选股。</p> : null}
        {loadState === "loaded-data" ? <div className="grid gap-4 xl:grid-cols-2">{filteredItems.map((item) => <WatchlistCard key={item.id} item={item} onEdit={editItem} onDelete={deleteItem} onAddToHoldings={addToHoldings} />)}</div> : null}
      </section>
    </div>
  );
}

function WatchlistCard({ item, onEdit, onDelete, onAddToHoldings }: { item: EnrichedWatchlistItem; onEdit: (item: EnrichedWatchlistItem) => void; onDelete: (item: EnrichedWatchlistItem) => void; onAddToHoldings: (item: EnrichedWatchlistItem) => void }) {
  return (
    <article className="rounded-lg border border-line bg-panel p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-ink">{item.ticker}</h3>
          <p className="text-sm text-muted">{item.companyName}</p>
        </div>
        <span className={`rounded-md px-3 py-1 text-sm font-semibold ${statusClass(item.watchlistStatus)}`}>{statusLabels[item.watchlistStatus]}</span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <MiniMetric label="当前价格" value={moneyOrDash(item.currentPrice)} />
        <MiniMetric label="当日涨跌" value={percentSignedOrDash(item.changePercent)} />
        <MiniMetric label="距离买入区" value={item.distanceToBuyZoneLabel ?? "--"} />
        <MiniMetric label="研究判断" value={researchLabels[item.researchJudgment]} />
        <MiniMetric label="行动状态" value={getWatchlistActionLabel(item)} />
        <MiniMetric label="覆盖率/可信度" value={`${(item.dataCoverage * 100).toFixed(0)}% / ${item.confidence}`} />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <InfoBox title="用户目标买入区" text={`${moneyOrDash(item.buyZoneLow)} - ${moneyOrDash(item.buyZoneHigh)}`} />
        <InfoBox title="财报日期" text={item.recentEarningsDate ? formatDate(item.recentEarningsDate) : "--"} />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ReasonList title="为什么继续观察" items={item.supportingReasons} fallback={item.watchReason ?? "暂无明确关注理由。"} tone="support" />
        <ReasonList title="需要等待或警惕" items={item.riskReasons} fallback="暂未触发明确风险。" tone="risk" />
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <DataSourceBadge quote={item.decision.quote} />
        <p className="text-xs text-muted">更新 {item.dataUpdatedAt ? formatDateTime(item.dataUpdatedAt) : "--"}</p>
        <div className="flex flex-wrap gap-3 text-sm font-semibold">
          <button onClick={() => onEdit(item)} className="text-blue-600 hover:text-blue-500">编辑计划</button>
          <button onClick={() => onAddToHoldings(item)} className="text-green-700 hover:text-green-600">加入持仓</button>
          <button onClick={() => onDelete(item)} className="text-red-600 hover:text-red-500">停止关注</button>
        </div>
      </div>
    </article>
  );
}

function compareItems(a: EnrichedWatchlistItem, b: EnrichedWatchlistItem, mode: SortMode) {
  if (mode === "research") return researchRank(b.researchJudgment) - researchRank(a.researchJudgment);
  if (mode === "coverage") return b.dataCoverage - a.dataCoverage;
  if (mode === "earnings") return dateRank(a.recentEarningsDate) - dateRank(b.recentEarningsDate);
  if (mode === "created") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  return (a.distanceToBuyZonePercent ?? Number.POSITIVE_INFINITY) - (b.distanceToBuyZonePercent ?? Number.POSITIVE_INFINITY);
}

function researchRank(value: EnrichedWatchlistItem["researchJudgment"]) {
  return { positive: 5, neutral_positive: 4, neutral: 3, cautious: 2, high_risk: 1, insufficient_data: 0 }[value];
}

function dateRank(value: string | null) {
  return value ? new Date(value).getTime() : Number.POSITIVE_INFINITY;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="space-y-1 text-sm font-semibold text-muted"><span>{label}</span>{children}</label>;
}

function SummaryCard({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "gain" | "warn" }) {
  const toneClass = tone === "gain" ? "text-green-700" : tone === "warn" ? "text-amber-700" : "text-ink";
  return <section className="rounded-lg border border-line bg-white p-5 shadow-soft"><p className="text-sm text-muted">{label}</p><p className={`mt-2 text-3xl font-semibold ${toneClass}`}>{value}</p></section>;
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border border-line bg-white p-3"><p className="text-xs text-muted">{label}</p><p className="mt-1 font-semibold text-ink">{value}</p></div>;
}

function InfoBox({ title, text }: { title: string; text: string }) {
  return <div className="rounded-md border border-line bg-white p-3"><p className="text-xs font-semibold text-muted">{title}</p><p className="mt-1 text-sm text-ink">{text}</p></div>;
}

function ReasonList({ title, items, fallback, tone }: { title: string; items: string[]; fallback: string; tone: "support" | "risk" }) {
  const className = tone === "support" ? "border-green-200 bg-green-50 text-green-800" : "border-amber-200 bg-amber-50 text-amber-900";
  return <section><h4 className="mb-2 font-semibold text-ink">{title}</h4><div className="space-y-2">{(items.length ? items : [fallback]).slice(0, 3).map((item) => <p key={item} className={`rounded-md border px-3 py-2 text-sm ${className}`}>{item}</p>)}</div></section>;
}

function statusClass(status: WatchlistStatus) {
  if (status === "buy_zone") return "bg-green-100 text-green-700";
  if (status === "wait_for_pullback") return "bg-blue-100 text-blue-700";
  if (status === "earnings_watch") return "bg-amber-100 text-amber-800";
  if (status === "abandoned") return "bg-slate-100 text-slate-500";
  if (status === "insufficient_data") return "bg-red-100 text-red-700";
  return "bg-violet-100 text-violet-700";
}

function getWatchlistActionLabel(item: EnrichedWatchlistItem) {
  if (item.watchlistStatus === "buy_zone") return "已进入买入区";
  if (item.watchlistStatus === "earnings_watch") return "财报观察";
  if (item.watchlistStatus === "abandoned") return "停止关注";
  if (item.watchlistStatus === "insufficient_data") return "数据不足";
  return actionLabels[item.actionStatus];
}

function moneyOrDash(value: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value) : "--";
}

function percentSignedOrDash(value: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? `${value >= 0 ? "+" : ""}${value.toFixed(2)}%` : "--";
}

function formatDate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric", weekday: "short" }).format(parsed);
}

function formatDateTime(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "--" : new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(parsed);
}

function readArrayPayload<T>(payload: unknown, legacyKey?: string): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    if (Array.isArray(record.data)) return record.data as T[];
    if (legacyKey && Array.isArray(record[legacyKey])) return record[legacyKey] as T[];
  }
  return [];
}

function readObjectPayload<T>(payload: unknown): T | null {
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    if (record.data && typeof record.data === "object") return record.data as T;
    if (record.item && typeof record.item === "object") return record.item as T;
  }
  return null;
}
