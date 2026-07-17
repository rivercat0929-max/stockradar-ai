"use client";

import { useEffect, useState } from "react";
import { DataSyncStatus, type DataSyncState } from "@/components/data-sync-status";
import { LocalStorageMigrationCard } from "@/components/local-storage-migration-card";
import { PageHeader } from "@/components/page-header";
import type { PortfolioAccount } from "@/lib/types";

type Settings = {
  defaultCurrency: "CAD" | "USD";
  defaultLanguage: "zh-CN" | "en-US";
  riskPreference: "保守" | "平衡" | "激进";
  aiScoreThreshold: number;
  alertThreshold: number;
  defaultAccountId: string;
};

type ProviderHealth = {
  name: "FMP" | "Yahoo" | "本地缓存";
  status: "正常" | "异常" | "未配置" | "降级中";
  label: DataLabelValue;
  lastUpdatedAt: string | null;
  failureCount: number;
  isUsingFallback: boolean;
  message: string;
};

type DataLabelValue = "真实数据" | "真实数据计算" | "缓存数据" | "数据可能过期" | "暂无可靠数据";

type DataHealth = {
  checkedAt: string;
  providers: ProviderHealth[];
  apiKey: {
    exists: boolean;
    prefix: string | null;
    usable: boolean;
    rateLimited: boolean;
    statusCode: number | null;
    message: string;
  };
  cache: {
    totalEntries: number;
    activeEntries: number;
    staleEntries: number;
    lastUpdatedAt: string | null;
    label: "缓存数据";
  };
  currentFallback: boolean;
  failureCount: number;
};

const storageKey = "stockradar-settings-v1";
const defaultSettings: Settings = {
  defaultCurrency: "CAD",
  defaultLanguage: "zh-CN",
  riskPreference: "平衡",
  aiScoreThreshold: 70,
  alertThreshold: 5,
  defaultAccountId: ""
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [accounts, setAccounts] = useState<PortfolioAccount[]>([]);
  const [health, setHealth] = useState<DataHealth | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<DataSyncState>("syncing");
  const [accessKey, setAccessKey] = useState("");
  const [accessUnlocked, setAccessUnlocked] = useState(false);
  const [accessMessage, setAccessMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    checkAccess();
    loadSettings();
    loadAccounts();
    runDiagnostics();
  }, []);

  async function checkAccess() {
    try {
      const response = await fetch("/api/access", { cache: "no-store" });
      const payload = await response.json();
      setAccessUnlocked(Boolean(payload.unlocked));
      if (!payload.configured) setAccessMessage("访问密码尚未配置，请先在 Vercel 设置 STOCKRADAR_ACCESS_KEY。");
    } catch {
      setAccessUnlocked(false);
    }
  }

  async function unlock(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAccessMessage(null);
    const response = await fetch("/api/access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessKey })
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.success) {
      setAccessUnlocked(false);
      setAccessMessage(payload?.error ?? "解锁失败。");
      return;
    }
    setAccessKey("");
    setAccessUnlocked(true);
    setAccessMessage("已解锁个人数据。");
    const next = new URLSearchParams(window.location.search).get("next");
    if (next && next.startsWith("/")) window.location.href = next;
  }

  async function lock() {
    await fetch("/api/access", { method: "DELETE" });
    setAccessUnlocked(false);
    setAccessMessage("已退出解锁状态。");
  }

  async function loadSettings() {
    try {
      const local = window.localStorage.getItem(storageKey);
      if (local) setSettings({ ...defaultSettings, ...JSON.parse(local) });
      const response = await fetch("/api/settings", { cache: "no-store" });
      const payload = await response.json();
      if (response.ok) {
        setSettings((current) => ({ ...current, ...(payload.data ?? payload) }));
        setSyncState("synced");
      } else {
        setSyncState("cloud-unavailable");
      }
    } catch {
      setMessage("设置读取失败，已使用默认设置。");
    }
  }

  async function loadAccounts() {
    try {
      const response = await fetch("/api/accounts", { cache: "no-store" });
      const payload = await response.json();
      setAccounts(Array.isArray(payload) ? payload : []);
    } catch {
      setAccounts([]);
    }
  }

  async function saveSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setMessage(null);

    try {
      window.localStorage.setItem(storageKey, JSON.stringify(settings));
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings)
      });
      const payload = await response.json();
      if (response.ok) {
        const nextSettings = payload.data ?? payload;
        setSettings(nextSettings);
        window.localStorage.setItem(storageKey, JSON.stringify(nextSettings));
        setSyncState("synced");
      } else {
        setSyncState("failed");
      }
      setMessage("设置已保存。");
    } catch {
      setMessage("服务端保存失败，但本地设置已保存在浏览器。");
    } finally {
      setIsSaving(false);
    }
  }

  async function runDiagnostics() {
    setIsChecking(true);
    setMessage(null);

    try {
      const response = await fetch("/api/data-health", { cache: "no-store" });
      const payload = await response.json();
      setHealth(payload);
      if (!response.ok) setMessage("系统诊断暂时不可用，已显示基础状态。");
    } catch {
      setMessage("系统诊断暂时不可用，请稍后重试。");
    } finally {
      setIsChecking(false);
    }
  }

  function updateSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings & Data Source Center V1"
        eyebrow="设置"
        description="查看系统数据来源、API Key 状态、缓存状态，并配置基础参数。"
        action={
          <button
            type="button"
            onClick={runDiagnostics}
            disabled={isChecking}
            className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isChecking ? "诊断中..." : "系统诊断"}
          </button>
        }
      />

      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-ink">单用户访问保护</h2>
            <p className="mt-1 text-sm text-muted">输入访问密码后，本浏览器会通过安全 Cookie 解锁个人持仓、自选股和设置。</p>
          </div>
          <span className={`rounded-md px-3 py-1 text-sm font-semibold ${accessUnlocked ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-800"}`}>
            {accessUnlocked ? "已解锁" : "未解锁"}
          </span>
        </div>
        <form onSubmit={unlock} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            value={accessKey}
            onChange={(event) => setAccessKey(event.target.value)}
            type="password"
            className="min-w-0 flex-1 rounded-md border border-line bg-panel px-3 py-2 outline-none focus:border-signal"
            placeholder="输入访问密码"
          />
          <button className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">解锁</button>
          {accessUnlocked ? <button type="button" onClick={lock} className="rounded-md border border-line px-4 py-2 text-sm font-semibold text-ink hover:bg-panel">退出解锁</button> : null}
        </form>
        {accessMessage ? <p className="mt-3 text-sm text-muted">{accessMessage}</p> : null}
      </section>

      <LocalStorageMigrationCard />
      <DataSyncStatus state={syncState} detail={syncState === "cloud-unavailable" ? "已保留浏览器本地设置备份" : null} />

      {message ? <p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">{message}</p> : null}

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
          <h2 className="text-lg font-semibold text-ink">设置卡片</h2>
          <form onSubmit={saveSettings} className="mt-4 grid gap-4 sm:grid-cols-2">
            <SelectField label="默认货币" value={settings.defaultCurrency} options={["CAD", "USD"]} onChange={(value) => updateSetting("defaultCurrency", value as Settings["defaultCurrency"])} />
            <SelectField label="默认语言" value={settings.defaultLanguage} options={["zh-CN", "en-US"]} labels={{ "zh-CN": "中文", "en-US": "English" }} onChange={(value) => updateSetting("defaultLanguage", value as Settings["defaultLanguage"])} />
            <SelectField label="风险偏好" value={settings.riskPreference} options={["保守", "平衡", "激进"]} onChange={(value) => updateSetting("riskPreference", value as Settings["riskPreference"])} />
            <label className="text-sm">
              <span className="font-medium text-ink">默认持仓账户</span>
              <select value={settings.defaultAccountId} onChange={(event) => updateSetting("defaultAccountId", event.target.value)} className="mt-1 w-full rounded-md border border-line bg-panel px-3 py-2 outline-none focus:border-signal">
                <option value="">未指定</option>
                {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
              </select>
            </label>
            <NumberField label="AI评分阈值" value={settings.aiScoreThreshold} min={0} max={100} onChange={(value) => updateSetting("aiScoreThreshold", value)} />
            <NumberField label="预警阈值 %" value={settings.alertThreshold} min={0} max={100} onChange={(value) => updateSetting("alertThreshold", value)} />
            <div className="sm:col-span-2">
              <button type="submit" disabled={isSaving} className="rounded-md bg-signal px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60">
                {isSaving ? "保存中..." : "保存设置"}
              </button>
            </div>
          </form>
          <p className="mt-4 text-xs text-muted">设置会保存到 Neon PostgreSQL，并在当前浏览器保留 localStorage 备份；云端暂不可用时不会清空本地备份。</p>
        </section>

        <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
          <h2 className="text-lg font-semibold text-ink">API Key状态卡片</h2>
          {health ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <StatusTile label="FMP_API_KEY" value={health.apiKey.exists ? "已配置" : "未配置"} tone={health.apiKey.exists ? "good" : "warn"} />
              <StatusTile label="Key前4位" value={health.apiKey.prefix ? `${health.apiKey.prefix}****` : "-"} />
              <StatusTile label="是否可用" value={health.apiKey.usable ? "可用" : "不可用"} tone={health.apiKey.usable ? "good" : "bad"} />
              <StatusTile label="免费额度限制" value={health.apiKey.rateLimited ? "可能触发" : "未发现"} tone={health.apiKey.rateLimited ? "warn" : "good"} />
              <p className="rounded-md border border-line bg-panel p-3 text-sm text-muted sm:col-span-2">{health.apiKey.message}</p>
            </div>
          ) : <EmptyState text="尚未完成诊断。" />}
        </section>
      </section>

      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-ink">数据源状态卡片</h2>
          {health ? <p className="text-sm text-muted">最近检查：{formatDateTime(health.checkedAt)}</p> : null}
        </div>
        {health ? (
          <div className="grid gap-4 lg:grid-cols-3">
            {health.providers.map((provider) => (
              <article key={provider.name} className="rounded-md border border-line bg-panel p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-ink">{provider.name}</h3>
                    <p className="mt-1 text-sm text-muted">{provider.message}</p>
                  </div>
                  <DataLabel label={provider.label} />
                </div>
                <div className="mt-4 grid gap-2 text-sm">
                  <Row label="状态" value={provider.status} />
                  <Row label="API失败次数" value={String(provider.failureCount)} />
                  <Row label="当前fallback" value={provider.isUsingFallback ? "是" : "否"} />
                  <Row label="最近更新时间" value={provider.lastUpdatedAt ? formatDateTime(provider.lastUpdatedAt) : "-"} />
                </div>
              </article>
            ))}
          </div>
        ) : <EmptyState text="点击系统诊断查看数据源状态。" />}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
          <h2 className="text-lg font-semibold text-ink">缓存状态卡片</h2>
          {health ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <StatusTile label="缓存条目" value={String(health.cache.totalEntries)} />
              <StatusTile label="有效缓存" value={String(health.cache.activeEntries)} />
              <StatusTile label="过期缓存" value={String(health.cache.staleEntries)} />
              <StatusTile label="最近更新时间" value={health.cache.lastUpdatedAt ? formatDateTime(health.cache.lastUpdatedAt) : "-"} />
            </div>
          ) : <EmptyState text="暂无缓存状态。" />}
        </section>

        <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
          <h2 className="text-lg font-semibold text-ink">数据透明度</h2>
          <div className="mt-4 grid gap-3">
            <Transparency label="真实数据" description="real：来自 FMP、Yahoo、SEC 等真实外部数据源；Yahoo 是真实备用数据源，不是 mock 或普通缓存。" />
            <Transparency label="真实数据计算" description="calculated：由真实行情、历史K线或 SEC 财务数据计算得到。" />
            <Transparency label="缓存数据" description="cache：真实数据的有效缓存。" />
            <Transparency label="数据可能过期" description="stale-cache：可能过期的真实数据，会降低可信度。" />
            <Transparency label="暂无可靠数据" description="unavailable：暂无可靠数据。mock 不用于生产评分，estimated 不参与正式评分。" />
          </div>
        </section>
      </section>
    </div>
  );
}

function SelectField({ label, value, options, labels, onChange }: { label: string; value: string; options: string[]; labels?: Record<string, string>; onChange: (value: string) => void }) {
  return (
    <label className="text-sm">
      <span className="font-medium text-ink">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-md border border-line bg-panel px-3 py-2 outline-none focus:border-signal">
        {options.map((option) => <option key={option} value={option}>{labels?.[option] ?? option}</option>)}
      </select>
    </label>
  );
}

function NumberField({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return (
    <label className="text-sm">
      <span className="font-medium text-ink">{label}</span>
      <input type="number" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} className="mt-1 w-full rounded-md border border-line bg-panel px-3 py-2 outline-none focus:border-signal" />
    </label>
  );
}

function StatusTile({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "good" | "warn" | "bad" | "neutral" }) {
  const toneClass = tone === "good" ? "text-green-700" : tone === "warn" ? "text-amber-800" : tone === "bad" ? "text-red-700" : "text-ink";
  return (
    <div className="rounded-md border border-line bg-panel p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1 font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-3"><span className="text-muted">{label}</span><span className="font-medium text-ink">{value}</span></div>;
}

function DataLabel({ label }: { label: DataLabelValue }) {
  const className = label === "真实数据" || label === "真实数据计算" ? "bg-green-100 text-green-700" : label === "缓存数据" ? "bg-blue-100 text-blue-700" : label === "数据可能过期" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600";
  return <span className={`rounded-md px-2 py-1 text-xs font-semibold ${className}`}>{label}</span>;
}

function Transparency({ label, description }: { label: DataLabelValue; description: string }) {
  return <div className="rounded-md border border-line bg-panel p-3"><DataLabel label={label} /><p className="mt-2 text-sm text-muted">{description}</p></div>;
}

function EmptyState({ text }: { text: string }) {
  return <p className="mt-4 rounded-md border border-line bg-panel px-3 py-6 text-center text-sm text-muted">{text}</p>;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
