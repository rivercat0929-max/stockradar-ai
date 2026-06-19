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
  assetType?: "ETF";
  scoreMode?: "full" | "market_only" | "estimated";
  dataSource?: "真实数据" | "缓存数据" | "估算数据" | "示例数据";
  stale?: boolean;
};

type AdvancedAlert = {
  id: string;
  ticker: string;
  category: "technical" | "volume" | "rsi" | "holding" | "earnings";
  riskLevel: "high" | "medium" | "low";
  title: string;
  message: string;
  valueLabel: string;
  source: "real" | "fallback" | "mock";
  createdAt: string;
};

type AlertsV2Data = {
  todayHighlights: AdvancedAlert[];
  holdingAlerts: AdvancedAlert[];
  history: AdvancedAlert[];
  errors: Array<{ ticker: string; error: string }>;
  dataSources: {
    real: string[];
    fallback: string[];
    mock: string[];
  };
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
  const [advancedAlerts, setAdvancedAlerts] = useState<AlertsV2Data | null>(null);
  const [isLoadingAdvancedAlerts, setIsLoadingAdvancedAlerts] = useState(false);
  const [advancedMessage, setAdvancedMessage] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");
  const [tickerFilter, setTickerFilter] = useState("");
  const [draftCategoryFilter, setDraftCategoryFilter] = useState("all");
  const [draftRiskFilter, setDraftRiskFilter] = useState("all");
  const [draftTickerFilter, setDraftTickerFilter] = useState("");
  const tickers = useMemo(() => Array.from(new Set(alerts.map((alert) => alert.ticker))), [alerts]);
  const filteredAdvancedAlerts = useMemo(() => {
    const normalizedTickerFilter = tickerFilter.trim().toUpperCase();
    return (advancedAlerts?.history ?? []).filter((alert) => {
      const categoryMatched = categoryFilter === "all" || alert.category === categoryFilter;
      const riskMatched = riskFilter === "all" || alert.riskLevel === riskFilter;
      const tickerMatched = !normalizedTickerFilter || alert.ticker.includes(normalizedTickerFilter);
      return categoryMatched && riskMatched && tickerMatched;
    });
  }, [advancedAlerts, categoryFilter, riskFilter, tickerFilter]);

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

  useEffect(() => {
    loadAdvancedAlerts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickers.join(",")]);

  async function loadAdvancedAlerts() {
    setIsLoadingAdvancedAlerts(true);
    setAdvancedMessage(null);

    try {
      const response = await fetch(`/api/alerts?tickers=${encodeURIComponent(tickers.join(","))}`, { cache: "no-store" });
      const data = await response.json();
      setAdvancedAlerts(data);
      if (Array.isArray(data.errors) && data.errors.length) setAdvancedMessage("部分数据源暂时不可用，已使用 fallback/mock 数据继续生成预警。");
    } catch {
      setAdvancedAlerts(null);
      setAdvancedMessage("高级预警暂时不可用，请稍后再试。");
    } finally {
      setIsLoadingAdvancedAlerts(false);
    }
  }

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

  function applyAdvancedFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCategoryFilter(draftCategoryFilter);
    setRiskFilter(draftRiskFilter);
    setTickerFilter(draftTickerFilter.trim().toUpperCase());
  }

  function resetAdvancedFilters() {
    setDraftCategoryFilter("all");
    setDraftRiskFilter("all");
    setDraftTickerFilter("");
    setCategoryFilter("all");
    setRiskFilter("all");
    setTickerFilter("");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("alerts")}
        eyebrow="Radar Alerts V2"
        description="高级股票雷达：技术突破、异常成交量、RSI、持仓风险和财报提醒。"
        action={
          <button
            type="button"
            onClick={() => {
              refreshAlerts();
              loadAdvancedAlerts();
            }}
            disabled={isLoading || isLoadingAdvancedAlerts}
            className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading || isLoadingAdvancedAlerts ? "加载中..." : "刷新雷达"}
          </button>
        }
      />

      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">今日重点预警</h2>
            <p className="mt-1 text-sm text-muted">优先展示高风险技术、持仓和成交量信号。</p>
          </div>
          {isLoadingAdvancedAlerts ? <span className="text-sm text-muted">正在扫描...</span> : null}
        </div>
        {advancedMessage ? <p className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">{advancedMessage}</p> : null}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(advancedAlerts?.todayHighlights ?? []).length ? (
            advancedAlerts!.todayHighlights.map((alert) => <AdvancedAlertCard key={alert.id} alert={alert} />)
          ) : (
            <p className="rounded-md border border-line bg-panel px-3 py-6 text-sm text-muted md:col-span-2 xl:col-span-3">暂无高风险重点预警。</p>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">筛选预警</h2>
          <p className="text-sm text-muted">当前显示 {filteredAdvancedAlerts.length} 条</p>
        </div>
        <form onSubmit={applyAdvancedFilters} className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto_auto] md:items-end">
          <label className="text-sm">
            <span className="font-medium text-ink">预警类型</span>
            <select value={draftCategoryFilter} onChange={(event) => setDraftCategoryFilter(event.target.value)} className="mt-1 w-full rounded-md border border-line bg-panel px-3 py-2 outline-none focus:border-signal">
              <option value="all">全部类型</option>
              <option value="technical">技术突破</option>
              <option value="volume">异常成交量</option>
              <option value="rsi">RSI</option>
              <option value="holding">持仓相关</option>
              <option value="earnings">财报</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="font-medium text-ink">风险等级</span>
            <select value={draftRiskFilter} onChange={(event) => setDraftRiskFilter(event.target.value)} className="mt-1 w-full rounded-md border border-line bg-panel px-3 py-2 outline-none focus:border-signal">
              <option value="all">全部等级</option>
              <option value="high">高风险</option>
              <option value="medium">中风险</option>
              <option value="low">低风险</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="font-medium text-ink">股票代码</span>
            <input value={draftTickerFilter} onChange={(event) => setDraftTickerFilter(event.target.value.toUpperCase())} className="mt-1 w-full rounded-md border border-line bg-panel px-3 py-2 outline-none focus:border-signal" placeholder="TSLA" />
          </label>
          <button type="submit" className="rounded-md bg-signal px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600">
            应用筛选
          </button>
          <button type="button" onClick={resetAdvancedFilters} className="rounded-md border border-line bg-white px-4 py-2 text-sm font-semibold text-muted hover:border-slate-400 hover:text-ink">
            重置
          </button>
        </form>
      </section>

      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <h2 className="text-lg font-semibold">持仓相关预警专区</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {(advancedAlerts?.holdingAlerts ?? []).length ? (
            advancedAlerts!.holdingAlerts.map((alert) => <AdvancedAlertCard key={alert.id} alert={alert} />)
          ) : (
            <p className="rounded-md border border-line bg-panel px-3 py-6 text-sm text-muted md:col-span-2">暂无持仓相关预警。</p>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">历史预警列表</h2>
          {advancedAlerts ? (
            <p className="text-xs text-muted">
              真实：{advancedAlerts.dataSources.real.length} / Fallback：{advancedAlerts.dataSources.fallback.length} / Mock：{advancedAlerts.dataSources.mock.length}
            </p>
          ) : null}
        </div>
        <div className="grid gap-3">
          {filteredAdvancedAlerts.length ? (
            filteredAdvancedAlerts.map((alert) => <AdvancedAlertRow key={alert.id} alert={alert} />)
          ) : (
            <p className="rounded-md border border-line bg-panel px-3 py-6 text-sm text-muted">没有符合筛选条件的预警。</p>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <h2 className="mb-4 text-lg font-semibold">自定义价格 / AI 评分预警</h2>
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
                      <td className="border-b border-line px-3 py-3">
                        {result ? (
                          <div>
                            <p>{result.score}/100</p>
                            {result.scoreMode === "market_only" ? <p className="text-xs text-muted">{t("marketOnlyScore")}</p> : null}
                            {result.scoreMode === "estimated" ? <p className="text-xs text-muted">含估算维度</p> : null}
                            {result.assetType === "ETF" ? <p className="text-xs text-muted">{t("etfDataNotice")}</p> : null}
                            {result.dataSource ? <p className="text-xs text-muted">{result.dataSource}</p> : null}
                          </div>
                        ) : (
                          <span className="text-muted">-</span>
                        )}
                      </td>
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

function AdvancedAlertCard({ alert }: { alert: AdvancedAlert }) {
  return (
    <div className={`rounded-lg border p-4 ${getRiskCardClass(alert.riskLevel)}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-muted">{getCategoryLabel(alert.category)} / {getSourceLabel(alert.source)}</p>
          <h3 className="mt-1 font-semibold text-ink">{alert.ticker} - {alert.title}</h3>
        </div>
        <span className={`rounded-md px-2 py-1 text-xs font-semibold ${getRiskBadgeClass(alert.riskLevel)}`}>{getRiskLabel(alert.riskLevel)}</span>
      </div>
      <p className="mt-3 text-sm text-muted">{alert.message}</p>
      <p className="mt-2 text-sm font-semibold text-signal">{alert.valueLabel}</p>
    </div>
  );
}

function AdvancedAlertRow({ alert }: { alert: AdvancedAlert }) {
  return (
    <div className="grid gap-2 rounded-md border border-line bg-panel px-3 py-3 text-sm md:grid-cols-[120px_120px_1fr_120px] md:items-center">
      <div>
        <p className="font-semibold text-ink">{alert.ticker}</p>
        <p className="text-xs text-muted">{getCategoryLabel(alert.category)}</p>
      </div>
      <span className={`w-fit rounded-md px-2 py-1 text-xs font-semibold ${getRiskBadgeClass(alert.riskLevel)}`}>{getRiskLabel(alert.riskLevel)}</span>
      <div>
        <p className="font-medium">{alert.title}</p>
        <p className="text-muted">{alert.message}</p>
      </div>
      <p className="font-semibold text-signal">{alert.valueLabel}</p>
    </div>
  );
}

function getCategoryLabel(category: AdvancedAlert["category"]) {
  if (category === "technical") return "技术突破";
  if (category === "volume") return "异常成交量";
  if (category === "rsi") return "RSI";
  if (category === "holding") return "持仓相关";
  return "财报";
}

function getRiskLabel(riskLevel: AdvancedAlert["riskLevel"]) {
  if (riskLevel === "high") return "高风险";
  if (riskLevel === "medium") return "中风险";
  return "低风险";
}

function getSourceLabel(source: AdvancedAlert["source"]) {
  if (source === "real") return "真实数据";
  if (source === "fallback") return "Fallback";
  return "Mock";
}

function getRiskBadgeClass(riskLevel: AdvancedAlert["riskLevel"]) {
  if (riskLevel === "high") return "bg-red-100 text-red-700";
  if (riskLevel === "medium") return "bg-amber-100 text-amber-800";
  return "bg-slate-100 text-slate-600";
}

function getRiskCardClass(riskLevel: AdvancedAlert["riskLevel"]) {
  if (riskLevel === "high") return "border-red-200 bg-red-50";
  if (riskLevel === "medium") return "border-amber-200 bg-amber-50";
  return "border-line bg-panel";
}
