"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { HoldingForm, type HoldingFormValues } from "@/components/holding-form";
import { useLanguage } from "@/components/language-provider";
import { PageHeader } from "@/components/page-header";
import type { Holding, PortfolioAccount } from "@/lib/types";

type SavePayload = {
  id?: string;
  accountId: string;
  ticker: string;
  companyName: string | null;
  shares: number;
  averageCost: number;
  targetAllocation: number | null;
  notes: string | null;
};

const allAccountsId = "all";

export default function HoldingsPage() {
  const { t } = useLanguage();
  const [accounts, setAccounts] = useState<PortfolioAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState(allAccountsId);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [editing, setEditing] = useState<Holding | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPortfolioData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredHoldings = useMemo(() => {
    if (selectedAccountId === allAccountsId) return holdings;
    return holdings.filter((holding) => holding.accountId === selectedAccountId);
  }, [holdings, selectedAccountId]);

  const totalCost = useMemo(
    () => filteredHoldings.reduce((sum, holding) => sum + (holding.totalCost ?? holding.shares * holding.averageCost), 0),
    [filteredHoldings]
  );
  const totalMarketValue = useMemo(
    () => filteredHoldings.reduce((sum, holding) => sum + (holding.marketValue ?? 0), 0),
    [filteredHoldings]
  );
  const totalUnrealizedPL = totalMarketValue - totalCost;
  const totalReturnPercent = totalCost > 0 ? (totalUnrealizedPL / totalCost) * 100 : 0;
  const isUsingFallbackPrices = filteredHoldings.some((holding) => holding.marketDataSource === "yahoo" || holding.marketDataSource === "mock");

  async function loadPortfolioData() {
    setIsLoading(true);
    setError(null);

    try {
      const [accountsResponse, holdingsResponse] = await Promise.all([
        fetch("/api/accounts", { cache: "no-store" }),
        fetch("/api/holdings", { cache: "no-store" })
      ]);
      const accountsData = await accountsResponse.json();
      const holdingsData = await holdingsResponse.json();

      if (!accountsResponse.ok) throw new Error(accountsData.error ?? t("loadAccountsError"));
      if (!holdingsResponse.ok) throw new Error(holdingsData.error ?? t("loadHoldingsError"));

      setAccounts(accountsData);
      setHoldings(holdingsData);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t("loadHoldingsError"));
    } finally {
      setIsLoading(false);
    }
  }

  async function saveHolding(values: HoldingFormValues) {
    const payload = editing ? { id: editing.id, ...toPayload(values) } : toPayload(values);
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/holdings", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? t("saveHoldingError"));

      setHoldings((current) => {
        if (!editing) return [data, ...current];
        return current.map((holding) => (holding.id === data.id ? data : holding));
      });
      closeForm();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t("saveHoldingError"));
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteHolding(holding: Holding) {
    const confirmed = window.confirm(t("deleteConfirm", { ticker: holding.ticker }));
    if (!confirmed) return;

    setError(null);
    try {
      const response = await fetch("/api/holdings", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: holding.id })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? t("deleteHoldingError"));
      setHoldings((current) => current.filter((item) => item.id !== holding.id));
      if (editing?.id === holding.id) closeForm();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : t("deleteHoldingError"));
    }
  }

  function openAddForm() {
    setEditing(null);
    setShowForm(true);
    setError(null);
  }

  function openEditForm(holding: Holding) {
    setEditing(holding);
    setShowForm(true);
    setError(null);
  }

  function closeForm() {
    setEditing(null);
    setShowForm(false);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("portfolio")}
        eyebrow={t("portfolioDatabase")}
        description={t("holdingsDescription")}
        action={
          <button onClick={openAddForm} className="rounded-md bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-400">
            {t("addHolding")}
          </button>
        }
      />

      <section className="rounded-lg border border-slate-800 bg-slate-950 p-5 text-white shadow-soft">
        <div className="mb-5 flex flex-wrap gap-2">
          <AccountFilterButton active={selectedAccountId === allAccountsId} onClick={() => setSelectedAccountId(allAccountsId)}>
            {t("allAccounts")}
          </AccountFilterButton>
          {accounts.map((account) => (
            <AccountFilterButton key={account.id} active={selectedAccountId === account.id} onClick={() => setSelectedAccountId(account.id)}>
              {account.name}
            </AccountFilterButton>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <SummaryCard label={t("holdingsCount")} value={filteredHoldings.length.toLocaleString()} />
          <SummaryCard label={t("totalCostBasis")} value={formatCurrency(totalCost)} />
          <SummaryCard label={t("totalMarketValue")} value={formatCurrency(totalMarketValue)} />
          <SummaryCard label={t("totalUnrealizedPL")} value={formatSignedCurrency(totalUnrealizedPL)} tone={totalUnrealizedPL >= 0 ? "gain" : "loss"} />
          <SummaryCard label={t("totalReturn")} value={formatPercent(totalReturnPercent)} tone={totalUnrealizedPL >= 0 ? "gain" : "loss"} />
        </div>
        {isUsingFallbackPrices ? (
          <p className="mt-4 rounded-md border border-amber-500/40 bg-amber-950/40 px-3 py-2 text-sm text-amber-100">
            {t("marketDataFallbackNotice")}
          </p>
        ) : null}
      </section>

      {showForm ? (
        <HoldingForm holding={editing} accounts={accounts} isSaving={isSaving} error={error} onSave={saveHolding} onCancel={closeForm} />
      ) : error ? (
        <p className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700">{error}</p>
      ) : null}

      <section className="rounded-lg border border-slate-800 bg-slate-950 p-5 text-white shadow-soft">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{t("holdingList")}</h2>
          {isLoading ? <span className="text-sm text-slate-400">{t("loading")}</span> : null}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[980px] border-separate border-spacing-0 text-left text-sm">
            <thead>
              <tr>
                {[
                  t("account"),
                  t("ticker"),
                  t("companyName"),
                  t("shares"),
                  t("averageCost"),
                  t("currentPrice"),
                  t("marketValue"),
                  t("unrealizedPL"),
                  t("returnPercent"),
                  t("allocation"),
                  t("actions")
                ].map((column) => (
                  <th key={column} className="border-b border-slate-800 bg-slate-900 px-3 py-3 font-semibold text-slate-300 first:rounded-l-md last:rounded-r-md">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!isLoading && filteredHoldings.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-3 py-8 text-center text-slate-400">
                    {t("noHoldings")}
                  </td>
                </tr>
              ) : null}
              {filteredHoldings.map((holding) => {
                const allocation = totalMarketValue > 0 ? ((holding.marketValue ?? 0) / totalMarketValue) * 100 : 0;

                return (
                  <tr key={holding.id} className="hover:bg-slate-900/70">
                    <td className="border-b border-slate-800 px-3 py-3 text-slate-300">{holding.account?.name ?? getAccountName(accounts, holding.accountId)}</td>
                    <td className="border-b border-slate-800 px-3 py-3 font-semibold">{holding.ticker}</td>
                    <td className="border-b border-slate-800 px-3 py-3 text-slate-300">{holding.companyName ?? "-"}</td>
                    <td className="border-b border-slate-800 px-3 py-3">{holding.shares.toLocaleString()}</td>
                    <td className="border-b border-slate-800 px-3 py-3">{formatCurrency(holding.averageCost)}</td>
                    <td className="border-b border-slate-800 px-3 py-3">{formatCurrency(holding.currentPrice ?? 0)}</td>
                    <td className="border-b border-slate-800 px-3 py-3">{formatCurrency(holding.marketValue ?? 0)}</td>
                    <td className={`border-b border-slate-800 px-3 py-3 ${getGainLossClass(holding.unrealizedPL ?? 0)}`}>
                      {formatSignedCurrency(holding.unrealizedPL ?? 0)}
                    </td>
                    <td className={`border-b border-slate-800 px-3 py-3 ${getGainLossClass(holding.unrealizedPL ?? 0)}`}>
                      {formatPercent(holding.unrealizedPLPercent ?? 0)}
                    </td>
                    <td className="border-b border-slate-800 px-3 py-3">{formatPercent(allocation)}</td>
                    <td className="border-b border-slate-800 px-3 py-3">
                      <div className="flex gap-3">
                        <button onClick={() => openEditForm(holding)} className="font-semibold text-blue-300 hover:text-blue-200">
                          {t("edit")}
                        </button>
                        <button onClick={() => deleteHolding(holding)} className="font-semibold text-red-300 hover:text-red-200">
                          {t("delete")}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function AccountFilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-3 py-2 text-sm font-semibold transition ${
        active ? "border-blue-400 bg-blue-500 text-white" : "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function SummaryCard({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "gain" | "loss" }) {
  const toneClass = tone === "gain" ? "text-green-300" : tone === "loss" ? "text-red-300" : "text-white";

  return (
    <div className="rounded-md border border-slate-800 bg-slate-900 p-4">
      <p className="text-sm text-slate-400">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

function getAccountName(accounts: PortfolioAccount[], accountId?: string) {
  if (!accountId) return "-";
  return accounts.find((account) => account.id === accountId)?.name ?? "-";
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2
  }).format(value);
}

function formatSignedCurrency(value: number) {
  const formatted = formatCurrency(Math.abs(value));
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `-${formatted}`;
  return formatted;
}

function formatPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function getGainLossClass(value: number) {
  if (value > 0) return "text-green-300";
  if (value < 0) return "text-red-300";
  return "text-slate-300";
}

function toPayload(values: HoldingFormValues): SavePayload {
  return {
    accountId: values.accountId,
    ticker: values.ticker.trim().toUpperCase(),
    companyName: optionalText(values.companyName),
    shares: Number(values.shares),
    averageCost: Number(values.averageCost),
    targetAllocation: values.targetAllocation.trim() ? Number(values.targetAllocation) : null,
    notes: optionalText(values.notes)
  };
}

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
