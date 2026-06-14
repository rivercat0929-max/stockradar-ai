"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/components/language-provider";
import type { Holding } from "@/lib/types";

export type HoldingFormValues = {
  ticker: string;
  companyName: string;
  shares: string;
  averageCost: string;
  targetAllocation: string;
  notes: string;
};

const emptyValues: HoldingFormValues = {
  ticker: "",
  companyName: "",
  shares: "",
  averageCost: "",
  targetAllocation: "",
  notes: ""
};

export function HoldingForm({
  holding,
  isSaving,
  error,
  onSave,
  onCancel
}: {
  holding: Holding | null;
  isSaving: boolean;
  error: string | null;
  onSave: (values: HoldingFormValues) => void;
  onCancel: () => void;
}) {
  const { t } = useLanguage();
  const [values, setValues] = useState<HoldingFormValues>(emptyValues);
  const [clientError, setClientError] = useState<string | null>(null);

  useEffect(() => {
    if (!holding) {
      setValues(emptyValues);
      setClientError(null);
      return;
    }

    setValues({
      ticker: holding.ticker,
      companyName: holding.companyName ?? "",
      shares: String(holding.shares),
      averageCost: String(holding.averageCost),
      targetAllocation: holding.targetAllocation == null ? "" : String(holding.targetAllocation),
      notes: holding.notes ?? ""
    });
    setClientError(null);
  }, [holding]);

  function update(key: keyof HoldingFormValues, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validate(values, t);
    setClientError(validationError);
    if (validationError) return;
    onSave(values);
  }

  const message = clientError ?? error;

  return (
    <form onSubmit={submit} className="rounded-lg border border-slate-700 bg-slate-950 p-5 text-white shadow-soft">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{holding ? t("editHolding") : t("addHolding")}</h2>
          <p className="mt-1 text-sm text-slate-400">{t("storedInDb")}</p>
        </div>
        {holding ? (
          <button type="button" onClick={onCancel} className="text-sm font-semibold text-slate-300 hover:text-white">
            {t("cancel")}
          </button>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("ticker")} value={values.ticker} onChange={(value) => update("ticker", value)} required />
        <Field label={t("companyName")} value={values.companyName} onChange={(value) => update("companyName", value)} />
        <Field label={t("shares")} type="number" min="0.000001" step="any" value={values.shares} onChange={(value) => update("shares", value)} required />
        <Field label={t("averageCost")} type="number" min="0" step="any" value={values.averageCost} onChange={(value) => update("averageCost", value)} required />
        <Field label={t("targetAllocationPercent")} type="number" min="0" step="any" value={values.targetAllocation} onChange={(value) => update("targetAllocation", value)} />
        <label className="text-sm sm:col-span-2">
          <span className="font-medium text-slate-300">{t("notes")}</span>
          <textarea
            value={values.notes}
            onChange={(event) => update("notes", event.target.value)}
            rows={3}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:border-blue-400"
          />
        </label>
      </div>

      {message ? <p className="mt-4 rounded-md border border-red-400/40 bg-red-950/60 px-3 py-2 text-sm text-red-100">{message}</p> : null}

      <button
        type="submit"
        disabled={isSaving}
        className="mt-5 rounded-md bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSaving ? t("saving") : t("save")}
      </button>
    </form>
  );
}

function Field({
  label,
  type = "text",
  value,
  onChange,
  required = false,
  min,
  step
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  min?: string;
  step?: string;
}) {
  return (
    <label className="text-sm">
      <span className="font-medium text-slate-300">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:border-blue-400"
        required={required}
        min={min}
        step={step}
      />
    </label>
  );
}

function validate(values: HoldingFormValues, t: ReturnType<typeof useLanguage>["t"]) {
  if (!values.ticker.trim()) return t("tickerRequired");
  if (!Number.isFinite(Number(values.shares)) || Number(values.shares) <= 0) return t("sharesPositive");
  if (!Number.isFinite(Number(values.averageCost)) || Number(values.averageCost) < 0) return t("averageCostNonNegative");
  return null;
}
