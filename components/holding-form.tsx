"use client";

import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/components/language-provider";
import type { Holding, PortfolioAccount } from "@/lib/types";

export type HoldingFormValues = {
  accountId: string;
  ticker: string;
  companyName: string;
  shares: string;
  averageCost: string;
  targetAllocation: string;
  notes: string;
};

const emptyValues: HoldingFormValues = {
  accountId: "",
  ticker: "",
  companyName: "",
  shares: "",
  averageCost: "",
  targetAllocation: "",
  notes: ""
};

export function HoldingForm({
  holding,
  accounts,
  isSaving,
  error,
  onSave,
  onCancel
}: {
  holding: Holding | null;
  accounts: PortfolioAccount[];
  isSaving: boolean;
  error: string | null;
  onSave: (values: HoldingFormValues) => void;
  onCancel: () => void;
}) {
  const { t } = useLanguage();
  const [values, setValues] = useState<HoldingFormValues>(emptyValues);
  const [clientError, setClientError] = useState<string | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupHint, setLookupHint] = useState<string | null>(null);
  const [companyNameEdited, setCompanyNameEdited] = useState(false);
  const [autoCompanyName, setAutoCompanyName] = useState<string | null>(null);
  const tickerRef = useRef("");
  const companyNameEditedRef = useRef(false);

  useEffect(() => {
    if (!holding) {
      setValues({ ...emptyValues, accountId: accounts[0]?.id ?? "" });
      setClientError(null);
      setLookupHint(null);
      setCompanyNameEdited(false);
      companyNameEditedRef.current = false;
      setAutoCompanyName(null);
      return;
    }

    setValues({
      accountId: holding.accountId ?? accounts[0]?.id ?? "",
      ticker: holding.ticker,
      companyName: holding.companyName ?? "",
      shares: String(holding.shares),
      averageCost: String(holding.averageCost),
      targetAllocation: holding.targetAllocation == null ? "" : String(holding.targetAllocation),
      notes: holding.notes ?? ""
    });
    setClientError(null);
    setLookupHint(null);
    const hasCompanyName = Boolean(holding.companyName?.trim());
    setCompanyNameEdited(hasCompanyName);
    companyNameEditedRef.current = hasCompanyName;
    setAutoCompanyName(null);
  }, [holding, accounts]);

  useEffect(() => {
    const symbol = values.ticker.trim().toUpperCase();
    tickerRef.current = symbol;
    if (!symbol || symbol.length < 2) {
      setIsLookingUp(false);
      setLookupHint(null);
      return;
    }

    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      setIsLookingUp(true);
      setLookupHint(null);
      try {
        const response = await fetch(`/api/stocks/lookup?symbol=${encodeURIComponent(symbol)}`, { cache: "no-store" });
        if (!response.ok) {
          setLookupHint(t("lookupCompanyNameFailed"));
          return;
        }

        const data = await response.json();
        const returnedSymbol = typeof data.symbol === "string" ? data.symbol.trim().toUpperCase() : "";
        const returnedCompanyName = typeof data.companyName === "string" ? data.companyName.trim() : "";
        if (!returnedSymbol || returnedSymbol !== tickerRef.current) return;
        if (!returnedCompanyName || returnedCompanyName.toUpperCase() === returnedSymbol) {
          setLookupHint(t("lookupCompanyNameFailed"));
          return;
        }

        if (!cancelled) {
          setValues((current) => {
            if (current.ticker.trim().toUpperCase() !== symbol) return current;
            if (companyNameEditedRef.current) return current;
            return {
              ...current,
              companyName: returnedCompanyName
            };
          });
          if (!companyNameEditedRef.current) setAutoCompanyName(returnedCompanyName);
        }
      } catch {
        setLookupHint(t("lookupCompanyNameFailed"));
      } finally {
        if (!cancelled) setIsLookingUp(false);
      }
    }, 800);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [t, values.ticker]);

  function update(key: keyof HoldingFormValues, value: string) {
    if (key === "ticker") {
      const ticker = value.toUpperCase();
      setLookupHint(null);
      setValues((current) => ({
        ...current,
        ticker,
        companyName: !companyNameEdited && autoCompanyName && current.companyName === autoCompanyName ? "" : current.companyName
      }));
      if (!companyNameEdited) setAutoCompanyName(null);
      return;
    }

    if (key === "companyName") {
      setCompanyNameEdited(true);
      companyNameEditedRef.current = true;
      setAutoCompanyName(null);
      setLookupHint(null);
    }

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
        <label className="text-sm">
          <span className="font-medium text-slate-300">{t("account")}</span>
          <select
            value={values.accountId}
            onChange={(event) => update("accountId", event.target.value)}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:border-blue-400"
            required
          >
            <option value="">{t("selectAccount")}</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </label>
        <Field label={t("ticker")} value={values.ticker} onChange={(value) => update("ticker", value)} required />
        <div>
          <Field label={t("companyName")} value={values.companyName} onChange={(value) => update("companyName", value)} />
          {isLookingUp ? <p className="mt-1 text-xs text-slate-400">{t("lookupCompanyName")}</p> : null}
          {!isLookingUp && lookupHint ? <p className="mt-1 text-xs text-amber-200">{lookupHint}</p> : null}
        </div>
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
  if (!values.accountId.trim()) return t("accountRequired");
  if (!values.ticker.trim()) return t("tickerRequired");
  if (!Number.isFinite(Number(values.shares)) || Number(values.shares) <= 0) return t("sharesPositive");
  if (!Number.isFinite(Number(values.averageCost)) || Number(values.averageCost) < 0) return t("averageCostNonNegative");
  return null;
}
