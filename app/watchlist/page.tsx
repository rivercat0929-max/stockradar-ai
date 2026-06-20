"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import type { PortfolioAccount } from "@/lib/types";
import { watchlistGroups, type EnrichedWatchlistItem, type WatchlistGroup } from "@/lib/watchlist";

type FormState = {
  ticker: string;
  companyName: string;
  group: WatchlistGroup;
  targetBuyPrice: string;
  targetSellPrice: string;
  watchReason: string;
  notes: string;
};

const allGroups = "全部分组";
const groupFilters: Array<typeof allGroups | WatchlistGroup> = [allGroups, ...watchlistGroups];

const emptyForm: FormState = {
  ticker: "",
  companyName: "",
  group: "重点观察",
  targetBuyPrice: "",
  targetSellPrice: "",
  watchReason: "",
  notes: ""
};

export default function WatchlistPage() {
  const [items, setItems] = useState<EnrichedWatchlistItem[]>([]);
  const [accounts, setAccounts] = useState<PortfolioAccount[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<typeof allGroups | WatchlistGroup>(allGroups);
  const [sortByAiScore, setSortByAiScore] = useState(true);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadWatchlist();
  }, []);

  const filteredItems = useMemo(() => {
    const filtered = selectedGroup === allGroups ? items : items.filter((item) => item.group === selectedGroup);
    if (!sortByAiScore) return filtered;
    return [...filtered].sort((a, b) => (b.aiScore ?? -1) - (a.aiScore ?? -1));
  }, [items, selectedGroup, sortByAiScore]);

  const nearTargetCount = items.filter((item) => item.isNearTarget).length;
  const alertCount = items.filter((item) => item.hasRecentAlert).length;

  async function loadWatchlist() {
    setIsLoading(true);
    setError(null);

    try {
      const [watchlistResponse, accountsResponse] = await Promise.all([
        fetch("/api/watchlist", { cache: "no-store" }),
        fetch("/api/accounts", { cache: "no-store" })
      ]);
      const watchlistData = await watchlistResponse.json();
      const accountsData = await accountsResponse.json();

      setItems(Array.isArray(watchlistData.items) ? watchlistData.items : []);
      setAccounts(Array.isArray(accountsData) ? accountsData : []);
      if (!watchlistResponse.ok) throw new Error(watchlistData.error ?? "自选股加载失败。");
      if (watchlistData.error) setError(watchlistData.error);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "自选股加载失败。");
      setItems([]);
    } finally {
      setIsLoading(false);
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
          targetBuyPrice: form.targetBuyPrice || null,
          targetSellPrice: form.targetSellPrice || null,
          watchReason: form.watchReason || null,
          notes: form.notes || null
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "自选股保存失败。");

      setItems((current) => (editingId ? current.map((item) => (item.id === data.id ? data : item)) : [data, ...current.filter((item) => item.id !== data.id)]));
      setForm(emptyForm);
      setEditingId(null);
      setMessage(editingId ? "已更新自选股。" : "已添加到自选股。");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "自选股保存失败。");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteItem(item: EnrichedWatchlistItem) {
    const confirmed = window.confirm(`确定删除 ${item.ticker} 吗？`);
    if (!confirmed) return;

    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/watchlist", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "删除失败。");
      setItems((current) => current.filter((currentItem) => currentItem.id !== item.id));
      if (editingId === item.id) cancelEdit();
      setMessage(`已删除 ${item.ticker}。`);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "删除失败。");
    }
  }

  async function addToHoldings(item: EnrichedWatchlistItem) {
    setError(null);
    setMessage(null);

    const account = accounts[0];
    if (!account) {
      setError("没有可用账户，无法一键加入持仓。");
      return;
    }

    try {
      const response = await fetch("/api/holdings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: account.id,
          ticker: item.ticker,
          companyName: item.companyName,
          shares: 1,
          averageCost: item.currentPrice ?? item.targetBuyPrice ?? 0,
          targetAllocation: null,
          notes: `来自自选股：${item.watchReason ?? item.notes ?? "一键加入"}`
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "加入持仓失败。");
      setMessage(`${item.ticker} 已按 1 股加入 ${account.name}。`);
    } catch (holdingError) {
      setError(holdingError instanceof Error ? holdingError.message : "加入持仓失败。");
    }
  }

  function editItem(item: EnrichedWatchlistItem) {
    setEditingId(item.id);
    setForm({
      ticker: item.ticker,
      companyName: item.companyName,
      group: item.group,
      targetBuyPrice: item.targetBuyPrice?.toString() ?? "",
      targetSellPrice: item.targetSellPrice?.toString() ?? "",
      watchReason: item.watchReason ?? "",
      notes: item.notes ?? ""
    });
    setMessage(null);
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
  }

  function setFormValue<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Watchlist V1"
        eyebrow="自选股"
        description="跟踪还没买、但想观察的股票，并自动联动 AI Score、预警和事件日历。"
        action={
          <button onClick={loadWatchlist} className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
            刷新
          </button>
        }
      />

      <section className="grid gap-4 md:grid-cols-3">
        <SummaryCard label="自选股数量" value={items.length.toString()} />
        <SummaryCard label="近期预警" value={alertCount.toString()} tone={alertCount ? "warn" : "neutral"} />
        <SummaryCard label="接近目标价" value={nearTargetCount.toString()} tone={nearTargetCount ? "gain" : "neutral"} />
      </section>

      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <form onSubmit={saveWatchlistItem} className="grid gap-4 lg:grid-cols-6">
          <Field label="股票代码">
            <input required value={form.ticker} onChange={(event) => setFormValue("ticker", event.target.value.toUpperCase())} className="input" placeholder="NVDA" />
          </Field>
          <Field label="公司名称">
            <input value={form.companyName} onChange={(event) => setFormValue("companyName", event.target.value)} className="input" placeholder="可自动识别" />
          </Field>
          <Field label="分组">
            <select value={form.group} onChange={(event) => setFormValue("group", event.target.value as WatchlistGroup)} className="input">
              {watchlistGroups.map((group) => (
                <option key={group} value={group}>{group}</option>
              ))}
            </select>
          </Field>
          <Field label="目标买入价">
            <input type="number" min="0" step="0.01" value={form.targetBuyPrice} onChange={(event) => setFormValue("targetBuyPrice", event.target.value)} className="input" placeholder="0.00" />
          </Field>
          <Field label="目标卖出价">
            <input type="number" min="0" step="0.01" value={form.targetSellPrice} onChange={(event) => setFormValue("targetSellPrice", event.target.value)} className="input" placeholder="0.00" />
          </Field>
          <div className="flex items-end gap-2">
            <button disabled={isSaving} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-400">
              {isSaving ? "保存中..." : editingId ? "更新" : "添加"}
            </button>
            {editingId ? (
              <button type="button" onClick={cancelEdit} className="rounded-md border border-line px-4 py-2 text-sm font-semibold text-ink hover:bg-panel">
                取消
              </button>
            ) : null}
          </div>
          <Field label="关注理由">
            <input value={form.watchReason} onChange={(event) => setFormValue("watchReason", event.target.value)} className="input" placeholder="AI、回调、财报前..." />
          </Field>
          <Field label="备注">
            <input value={form.notes} onChange={(event) => setFormValue("notes", event.target.value)} className="input" placeholder="记录你的观察计划" />
          </Field>
        </form>
      </section>

      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {groupFilters.map((group) => (
              <button
                key={group}
                onClick={() => setSelectedGroup(group)}
                className={`rounded-md border px-3 py-2 text-sm font-semibold ${selectedGroup === group ? "border-blue-500 bg-blue-50 text-blue-700" : "border-line bg-white text-muted hover:text-ink"}`}
              >
                {group}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold text-muted">
            <input type="checkbox" checked={sortByAiScore} onChange={(event) => setSortByAiScore(event.target.checked)} />
            AI评分排序
          </label>
        </div>

        {isLoading ? <p className="rounded-md border border-line bg-panel p-4 text-sm text-muted">正在加载自选股...</p> : null}
        {error ? <p className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">{error}</p> : null}
        {message ? <p className="mb-4 rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-700">{message}</p> : null}

        <div className="overflow-x-auto">
          <table className="min-w-[1280px] border-separate border-spacing-0 text-left text-sm">
            <thead>
              <tr>
                {["分组", "股票", "当前价格", "今日涨跌", "AI Score", "Rating", "最近财报", "近期预警", "目标价提醒", "数据来源", "理由 / 备注", "操作"].map((column) => (
                  <th key={column} className="border-b border-line bg-panel px-3 py-3 font-semibold text-muted first:rounded-l-md last:rounded-r-md">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!isLoading && filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-3 py-10 text-center text-muted">
                    暂无自选股。添加第一只股票后，它会自动进入预警扫描和事件日历范围。
                  </td>
                </tr>
              ) : null}
              {filteredItems.map((item) => (
                <tr key={item.id} className="hover:bg-panel/70">
                  <td className="border-b border-line px-3 py-3"><GroupBadge group={item.group} /></td>
                  <td className="border-b border-line px-3 py-3">
                    <p className="font-semibold text-ink">{item.ticker}</p>
                    <p className="text-xs text-muted">{item.companyName}</p>
                  </td>
                  <td className="border-b border-line px-3 py-3">{item.currentPrice === null ? "-" : formatCurrency(item.currentPrice)}</td>
                  <td className={`border-b border-line px-3 py-3 ${getMoveClass(item.changePercent ?? 0)}`}>{item.changePercent === null ? "-" : formatPercent(item.changePercent)}</td>
                  <td className="border-b border-line px-3 py-3 font-semibold">{item.aiScore === null ? "-" : `${item.aiScore}/100`}</td>
                  <td className="border-b border-line px-3 py-3">
                    {item.rating ? <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${getRatingClass(item.aiScore ?? 0)}`}>{item.ratingLabel ?? item.rating}</span> : "-"}
                  </td>
                  <td className="border-b border-line px-3 py-3">{item.recentEarningsDate ?? "-"}</td>
                  <td className="border-b border-line px-3 py-3">{item.hasRecentAlert ? <span className="text-amber-700">{item.alertLabel}</span> : <span className="text-muted">无</span>}</td>
                  <td className="border-b border-line px-3 py-3">{item.targetDistanceLabel ? <span className={item.isNearTarget ? "font-semibold text-green-700" : "text-muted"}>{item.targetDistanceLabel}</span> : "-"}</td>
                  <td className="border-b border-line px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      <SourceBadge label={`价格 ${item.priceDataSource}`} />
                      <SourceBadge label={`评分 ${item.scoreDataSource}`} />
                      <SourceBadge label={`事件 ${item.eventDataSource}`} />
                    </div>
                  </td>
                  <td className="border-b border-line px-3 py-3 text-muted">
                    <p>{item.watchReason ?? "-"}</p>
                    {item.notes ? <p className="mt-1 text-xs">{item.notes}</p> : null}
                  </td>
                  <td className="border-b border-line px-3 py-3">
                    <div className="flex flex-wrap gap-3">
                      <button onClick={() => editItem(item)} className="font-semibold text-blue-600 hover:text-blue-500">编辑</button>
                      <button onClick={() => deleteItem(item)} className="font-semibold text-red-600 hover:text-red-500">删除</button>
                      <button onClick={() => addToHoldings(item)} className="font-semibold text-green-700 hover:text-green-600">加入持仓</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1 text-sm font-semibold text-muted">
      <span>{label}</span>
      {children}
    </label>
  );
}

function SummaryCard({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "gain" | "warn" }) {
  const toneClass = tone === "gain" ? "text-green-700" : tone === "warn" ? "text-amber-700" : "text-ink";
  return (
    <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
      <p className="text-sm text-muted">{label}</p>
      <p className={`mt-2 text-3xl font-semibold ${toneClass}`}>{value}</p>
    </section>
  );
}

function GroupBadge({ group }: { group: WatchlistGroup }) {
  const className =
    group === "重点观察"
      ? "border-blue-200 bg-blue-50 text-blue-700"
      : group === "等待回调"
        ? "border-green-200 bg-green-50 text-green-700"
        : group === "财报前观察"
          ? "border-amber-200 bg-amber-50 text-amber-800"
          : group === "已放弃"
            ? "border-slate-200 bg-slate-100 text-slate-500"
            : "border-violet-200 bg-violet-50 text-violet-700";
  return <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${className}`}>{group}</span>;
}

function SourceBadge({ label }: { label: string }) {
  return <span className="rounded-md border border-line bg-panel px-2 py-1 text-xs text-muted">{label}</span>;
}

function getMoveClass(value: number) {
  if (value > 0) return "text-green-700";
  if (value < 0) return "text-red-600";
  return "text-muted";
}

function getRatingClass(score: number) {
  if (score >= 80) return "border-green-300 bg-green-50 text-green-700";
  if (score >= 65) return "border-blue-300 bg-blue-50 text-blue-700";
  if (score >= 50) return "border-amber-300 bg-amber-50 text-amber-800";
  return "border-red-300 bg-red-50 text-red-700";
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
}

function formatPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}
