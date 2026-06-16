"use client";

import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/components/language-provider";
import { PageHeader } from "@/components/page-header";

type AlertType = "price_above" | "price_below" | "score_above" | "score_below";

type RadarAlert = {
  id: string;
  ticker: string;
  alertType: AlertType;
  targetValue: number;
};

type AlertCheckResult = {
  ticker: string;
  score: number;
  rating: string;
  price: number;
  changesPercentage: number;
  stale?: boolean;
};

const storageKey = "stockradar-alerts-v1";

export default function AlertsPage() {
  const { t } = useLanguage();
  const [alerts, setAlerts] = useState<RadarAlert[]>([]);
  const [ticker, setTicker] = useState("");
  const [alertType, setAlertType] = useState<AlertType>("price_above");
  const [targetValue, setTargetValue] = useState("");
  const [results, setResults] = useState<Record<string, AlertCheckResult>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoadedLocalAlerts, setHasLoadedLocalAlerts] = useState(false);
  const tickers = useMemo(() => Array.from(new Set(alerts.map((alert) => alert.ticker))), [alerts]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setAlerts(parsed.filter(isRadarAlert));
      }
    } catch {
      setMessage(t("alertsLoadError"));
    } finally {
      setHasLoadedLocalAlerts(true);
    }
  }, [t]);

  useEffect(() => {
    if (!hasLoadedLocalAlerts) return;
    window.localStorage.setItem(storageKey, JSON.stringify(alerts));
  }, [alerts, hasLoadedLocalAlerts]);

  useEffect(() => {
    if (tickers.length) {
      refreshAlerts(tickers);
    } else {
      setResults({});
      setErrors({});
      setMessage(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickers.join(",")]);

  async function refreshAlerts(nextTickers = tickers) {
    if (!nextTickers.length) return;

    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/alerts/check?tickers=${encodeURIComponent(nextTickers.join(","))}`, { cache: "no-store" });
      const data = await response.json();
      const nextResults: Record<string, AlertCheckResult> = {};
      const nextErrors: Record<string, string> = {};

      if (Array.isArray(data.results)) {
        data.results.forEach((result: AlertCheckResult) => {
          nextResults[result.ticker.toUpperCase()] = result;
        });
      }

      if (Array.isArray(data.errors)) {
        data.errors.forEach((item: { ticker?: string | null; error?: string }) => {
          if (item.ticker) nextErrors[item.ticker.toUpperCase()] = item.error ?? t("alertCheckUnavailable");
        });
      }

      if (!response.ok && !Object.keys(nextErrors).length) {
        nextTickers.forEach((item) => {
          nextErrors[item] = t("alertCheckUnavailable");
        });
      }

      setResults(nextResults);
      setErrors(nextErrors);
      if (Object.keys(nextErrors).length) setMessage(t("someAlertsUnavailable"));
    } catch {
      setResults({});
      setErrors(Object.fromEntries(nextTickers.map((item) => [item, t("alertCheckUnavailable")])));
      setMessage(t("alertsRefreshError"));
    } finally {
      setIsLoading(false);
    }
  }

  function addAlert(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedTicker = ticker.trim().toUpperCase();
    const parsedTargetValue = Number(targetValue);

    if (!normalizedTicker) {
      setMessage(t("tickerRequired"));
      return;
    }

    if (!Number.isFinite(parsedTargetValue)) {
      setMessage(t("targetValueRequired"));
      return;
    }

    setAlerts((current) => [
      {
        id: `${normalizedTicker}-${alertType}-${Date.now()}`,
        ticker: normalizedTicker,
        alertType,
        targetValue: parsedTargetValue
      },
      ...current
    ]);
    setTicker("");
    setTargetValue("");
    setMessage(null);
  }

  function deleteAlert(id: string) {
    setAlerts((current) => current.filter((alert) => alert.id !== id));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("alerts")}
        eyebrow="Radar Alerts V1"
        description={t("alertsDescription")}
        action={
          <button
            type="button"
            onClick={() => refreshAlerts()}
            disabled={isLoading || tickers.length === 0}
            className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? t("loading") : t("refresh")}
          </button>
        }
      />

      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <form onSubmit={addAlert} className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end">
          <label className="text-sm">
            <span className="font-medium text-ink">{t("ticker")}</span>
            <input
              value={ticker}
              onChange={(event) => setTicker(event.target.value.toUpperCase())}
              className="mt-1 w-full rounded-md border border-line bg-panel px-3 py-2 text-ink outline-none focus:border-signal"
              placeholder="TSLA"
            />
          </label>

          <label className="text-sm">
            <span className="font-medium text-ink">{t("alertType")}</span>
            <select
              value={alertType}
              onChange={(event) => setAlertType(event.target.value as AlertType)}
              className="mt-1 w-full rounded-md border border-line bg-panel px-3 py-2 text-ink outline-none focus:border-signal"
            >
              <option value="price_above">{t("priceAbove")}</option>
              <option value="price_below">{t("priceBelow")}</option>
              <option value="score_above">{t("scoreAbove")}</option>
              <option value="score_below">{t("scoreBelow")}</option>
            </select>
          </label>

          <label className="text-sm">
            <span className="font-medium text-ink">{t("targetValue")}</span>
            <input
              type="number"
              step="any"
              value={targetValue}
              onChange={(event) => setTargetValue(event.target.value)}
              className="mt-1 w-full rounded-md border border-line bg-panel px-3 py-2 text-ink outline-none focus:border-signal"
              placeholder="100"
            />
          </label>

          <button type="submit" className="rounded-md bg-signal px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600">
            {t("addAlert")}
          </button>
        </form>

        {message ? <p className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">{message}</p> : null}
      </section>

      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{t("alertList")}</h2>
          {isLoading ? <span className="text-sm text-muted">{t("loading")}</span> : null}
        </div>

        {alerts.length === 0 ? (
          <p className="rounded-md border border-line bg-panel px-3 py-8 text-center text-sm text-muted">{t("noAlerts")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[920px] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr>
                  {[t("ticker"), t("condition"), t("targetValue"), t("currentPrice"), t("aiScore"), t("status"), t("actions")].map((column) => (
                    <th key={column} className="border-b border-line bg-panel px-3 py-3 font-semibold text-muted first:rounded-l-md last:rounded-r-md">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {alerts.map((alert) => {
                  const result = results[alert.ticker];
                  const isTriggered = result ? isAlertTriggered(alert, result) : false;
                  const error = errors[alert.ticker];

                  return (
                    <tr key={alert.id} className="hover:bg-panel/70">
                      <td className="border-b border-line px-3 py-3 font-semibold text-ink">{alert.ticker}</td>
                      <td className="border-b border-line px-3 py-3 text-muted">{getAlertTypeLabel(alert.alertType, t)}</td>
                      <td className="border-b border-line px-3 py-3">{formatNumber(alert.targetValue)}</td>
                      <td className="border-b border-line px-3 py-3">
                        {result ? formatCurrency(result.price) : <span className="text-muted">-</span>}
                        {result?.stale ? <p className="text-xs text-amber-700">{t("usingCachedData")}</p> : null}
                      </td>
                      <td className="border-b border-line px-3 py-3">{result ? `${result.score}/100` : <span className="text-muted">-</span>}</td>
                      <td className="border-b border-line px-3 py-3">
                        {result ? (
                          <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${isTriggered ? "border-green-300 bg-green-50 text-green-700" : "border-slate-300 bg-slate-50 text-slate-600"}`}>
                            {isTriggered ? t("triggered") : t("notTriggered")}
                          </span>
                        ) : (
                          <span className="text-muted">{error ? t("alertCheckUnavailable") : t("loading")}</span>
                        )}
                      </td>
                      <td className="border-b border-line px-3 py-3">
                        <button onClick={() => deleteAlert(alert.id)} className="font-semibold text-red-600 hover:text-red-500">
                          {t("delete")}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-xs text-muted">{t("alertsCheckDisclaimer")}</p>
    </div>
  );
}

function isRadarAlert(value: unknown): value is RadarAlert {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Partial<RadarAlert>;
  return (
    typeof item.id === "string" &&
    typeof item.ticker === "string" &&
    isAlertType(item.alertType) &&
    typeof item.targetValue === "number" &&
    Number.isFinite(item.targetValue)
  );
}

function isAlertType(value: unknown): value is AlertType {
  return value === "price_above" || value === "price_below" || value === "score_above" || value === "score_below";
}

function isAlertTriggered(alert: RadarAlert, result: AlertCheckResult) {
  if (alert.alertType === "price_above") return result.price > alert.targetValue;
  if (alert.alertType === "price_below") return result.price < alert.targetValue;
  if (alert.alertType === "score_above") return result.score > alert.targetValue;
  return result.score < alert.targetValue;
}

function getAlertTypeLabel(alertType: AlertType, t: ReturnType<typeof useLanguage>["t"]) {
  if (alertType === "price_above") return t("priceAbove");
  if (alertType === "price_below") return t("priceBelow");
  if (alertType === "score_above") return t("scoreAbove");
  return t("scoreBelow");
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}
