"use client";

import { useEffect, useMemo, useState } from "react";
import { Disclaimer } from "@/components/disclaimer";
import { HoldingForm, type HoldingFormValues } from "@/components/holding-form";
import { useLanguage } from "@/components/language-provider";
import { PageHeader } from "@/components/page-header";
import type { Holding } from "@/lib/types";

type SavePayload = {
  id?: string;
  ticker: string;
  companyName: string | null;
  shares: number;
  averageCost: number;
  targetAllocation: number | null;
  notes: string | null;
};

export default function HoldingsPage() {
  const { t } = useLanguage();
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [editing, setEditing] = useState<Holding | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadHoldings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalCost = useMemo(
    () => holdings.reduce((sum, holding) => sum + holding.shares * holding.averageCost, 0),
    [holdings]
  );

  async function loadHoldings() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/holdings", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? t("loadHoldingsError"));
      setHoldings(data);
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
        <div className="grid gap-4 sm:grid-cols-3">
          <SummaryCard label={t("holdingsCount")} value={holdings.length.toLocaleString()} />
          <SummaryCard label={t("totalCostBasis")} value={`$${totalCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}`} />
          <SummaryCard label={t("storage")} value="SQLite" />
        </div>
      </section>

      {showForm ? (
        <HoldingForm holding={editing} isSaving={isSaving} error={error} onSave={saveHolding} onCancel={closeForm} />
      ) : error ? (
        <p className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700">{error}</p>
      ) : null}

      <section className="rounded-lg border border-slate-800 bg-slate-950 p-5 text-white shadow-soft">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{t("holdingList")}</h2>
          {isLoading ? <span className="text-sm text-slate-400">{t("loading")}</span> : null}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
            <thead>
              <tr>
                {[t("ticker"), t("companyName"), t("shares"), t("averageCost"), t("targetAllocation"), t("notes"), t("actions")].map((column) => (
                  <th key={column} className="border-b border-slate-800 bg-slate-900 px-3 py-3 font-semibold text-slate-300 first:rounded-l-md last:rounded-r-md">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!isLoading && holdings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-slate-400">
                    {t("noHoldings")}
                  </td>
                </tr>
              ) : null}
              {holdings.map((holding) => (
                <tr key={holding.id} className="hover:bg-slate-900/70">
                  <td className="border-b border-slate-800 px-3 py-3 font-semibold">{holding.ticker}</td>
                  <td className="border-b border-slate-800 px-3 py-3 text-slate-300">{holding.companyName ?? "-"}</td>
                  <td className="border-b border-slate-800 px-3 py-3">{holding.shares.toLocaleString()}</td>
                  <td className="border-b border-slate-800 px-3 py-3">${holding.averageCost.toLocaleString()}</td>
                  <td className="border-b border-slate-800 px-3 py-3">{holding.targetAllocation == null ? "-" : `${holding.targetAllocation}%`}</td>
                  <td className="max-w-xs border-b border-slate-800 px-3 py-3 text-slate-300">{holding.notes ?? "-"}</td>
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
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Disclaimer />
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-800 bg-slate-900 p-4">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function toPayload(values: HoldingFormValues): SavePayload {
  return {
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
