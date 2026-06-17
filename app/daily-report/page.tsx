"use client";

import { useState } from "react";
import { PageHeader } from "@/components/page-header";

type SourceLabel = "真实数据" | "缓存数据" | "静态数据" | "示例数据";

type DailyReport = {
  generatedAt: string;
  reportDate: string;
  summary: {
    holdingsCount: number;
    totalMarketValue: number;
    totalUnrealizedPL: number;
    totalReturnPercent: number;
    topGainers: HoldingItem[];
    topLosers: HoldingItem[];
  };
  alerts: {
    todayHighlights: AlertItem[];
    holdingAlerts: AlertItem[];
    source: SourceLabel;
  };
  events: {
    nextSevenDays: EventItem[];
    highRiskEvents: EventItem[];
    source: SourceLabel;
  };
  riskReminders: string[];
  aiCommentary: string;
  reportText: string;
  dataSources: Array<{
    name: string;
    source: SourceLabel;
    detail: string;
  }>;
  emailProviders: Array<{
    name: string;
    status: string;
  }>;
  errors: string[];
};

type HoldingItem = {
  ticker: string;
  accountName: string;
  companyName: string;
  marketValue: number;
  unrealizedPL: number;
  unrealizedPLPercent: number;
  allocation: number;
  source: SourceLabel;
};

type AlertItem = {
  id: string;
  ticker: string;
  riskLevel: "high" | "medium" | "low";
  title: string;
  message: string;
  valueLabel: string;
  source: "real" | "fallback" | "mock";
};

type EventItem = {
  id: string;
  date: string;
  ticker?: string;
  title: string;
  description: string;
  source: "real" | "fallback" | "mock";
};

export default function DailyReportPage() {
  const [report, setReport] = useState<DailyReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>("点击“生成今日报告”读取当前持仓、预警和未来7天事件。");
  const [copied, setCopied] = useState(false);

  async function generateReport() {
    setIsLoading(true);
    setCopied(false);
    setMessage(null);

    try {
      const response = await fetch("/api/daily-report", { cache: "no-store" });
      const payload = await response.json();
      setReport(payload);
      if (!response.ok || payload.errors?.length) {
        setMessage("部分数据源暂时不可用，已使用可用数据生成报告预览。");
      }
    } catch {
      setMessage("每日报告暂时无法生成，请稍后再试。");
    } finally {
      setIsLoading(false);
    }
  }

  async function copyReport() {
    if (!report?.reportText) return;

    try {
      await navigator.clipboard.writeText(report.reportText);
      setCopied(true);
      setMessage("报告内容已复制。");
    } catch {
      setCopied(false);
      setMessage("复制失败，请手动选择报告内容复制。");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Email Daily Report V1"
        eyebrow="每日投资雷达报告"
        description="生成中文每日投资雷达报告预览。V1 暂不自动发送邮件，先支持页面生成和复制。"
        action={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={generateReport}
              disabled={isLoading}
              className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? "正在生成..." : "生成今日报告"}
            </button>
            <button
              type="button"
              onClick={copyReport}
              disabled={!report?.reportText}
              className="rounded-md border border-line bg-white px-4 py-2 text-sm font-semibold text-ink hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {copied ? "已复制" : "复制报告内容"}
            </button>
          </div>
        }
      />

      {message ? <p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">{message}</p> : null}

      {report ? (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard title="总市值" value={formatCurrency(report.summary.totalMarketValue)} source="真实/缓存" />
            <MetricCard title="浮动盈亏" value={formatCurrency(report.summary.totalUnrealizedPL)} tone={report.summary.totalUnrealizedPL >= 0 ? "positive" : "negative"} source="真实/缓存" />
            <MetricCard title="总收益率" value={formatPercent(report.summary.totalReturnPercent)} tone={report.summary.totalReturnPercent >= 0 ? "positive" : "negative"} source="真实/缓存" />
            <MetricCard title="持仓数量" value={`${report.summary.holdingsCount} 只`} source="真实数据" />
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <Panel title="表现较强持仓">
              <HoldingList holdings={report.summary.topGainers} emptyText="暂无持仓数据" />
            </Panel>
            <Panel title="表现较弱持仓">
              <HoldingList holdings={report.summary.topLosers} emptyText="暂无持仓数据" />
            </Panel>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <Panel title="今日重点预警" badge={report.alerts.source}>
              <div className="space-y-3">
                {report.alerts.todayHighlights.length ? (
                  report.alerts.todayHighlights.map((alert) => <AlertCard key={alert.id} alert={alert} />)
                ) : (
                  <EmptyState text="今日暂无重点预警" />
                )}
              </div>
            </Panel>
            <Panel title="未来7天事件" badge={report.events.source}>
              <div className="space-y-3">
                {report.events.nextSevenDays.length ? (
                  report.events.nextSevenDays.map((event) => <EventCard key={event.id} event={event} />)
                ) : (
                  <EmptyState text="未来7天暂无重要事件" />
                )}
              </div>
            </Panel>
          </section>

          <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <Panel title="风险提醒">
              <ul className="space-y-2 text-sm text-muted">
                {report.riskReminders.map((item) => (
                  <li key={item} className="rounded-md border border-line bg-panel px-3 py-2">
                    {item}
                  </li>
                ))}
              </ul>
            </Panel>
            <Panel title="AI简评" badge="静态数据">
              <p className="rounded-md border border-line bg-panel p-4 text-sm leading-6 text-muted">{report.aiCommentary}</p>
            </Panel>
          </section>

          <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">报告预览</h2>
                <p className="mt-1 text-sm text-muted">生成时间：{formatDateTime(report.generatedAt)}</p>
              </div>
              <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">页面预览版</span>
            </div>
            <pre className="max-h-[560px] overflow-auto whitespace-pre-wrap rounded-md border border-line bg-slate-950 p-4 text-sm leading-6 text-slate-100">
              {report.reportText}
            </pre>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <Panel title="数据来源标注">
              <div className="space-y-3">
                {report.dataSources.map((item) => (
                  <div key={item.name} className="rounded-md border border-line bg-panel px-3 py-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-ink">{item.name}</p>
                      <SourceBadge source={item.source} />
                    </div>
                    <p className="mt-1 text-muted">{item.detail}</p>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel title="邮件发送接口预留">
              <div className="space-y-3">
                {report.emailProviders.map((provider) => (
                  <div key={provider.name} className="flex items-center justify-between rounded-md border border-line bg-panel px-3 py-3 text-sm">
                    <span className="font-semibold text-ink">{provider.name}</span>
                    <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">{provider.status}</span>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs text-muted">V1 不自动发送邮件，后续可以接入 SendGrid、Gmail SMTP 或 Resend。</p>
            </Panel>
          </section>

          {report.errors.length ? (
            <section className="rounded-lg border border-amber-300 bg-amber-50 p-5 text-sm text-amber-800">
              <h2 className="font-semibold">数据源提示</h2>
              <ul className="mt-2 space-y-1">
                {report.errors.slice(0, 8).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : (
        <section className="rounded-lg border border-line bg-white p-8 text-center shadow-soft">
          <h2 className="text-lg font-semibold text-ink">尚未生成今日报告</h2>
          <p className="mt-2 text-sm text-muted">点击上方按钮后，会读取当前 Holdings、Radar Alerts V2 和 Event Calendar 数据。</p>
        </section>
      )}
    </div>
  );
}

function MetricCard({ title, value, source, tone = "neutral" }: { title: string; value: string; source: string; tone?: "positive" | "negative" | "neutral" }) {
  return (
    <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
      <p className="text-sm text-muted">{title}</p>
      <p className={`mt-2 text-2xl font-bold ${tone === "positive" ? "text-green-700" : tone === "negative" ? "text-red-600" : "text-ink"}`}>{value}</p>
      <p className="mt-2 text-xs text-muted">来源：{source}</p>
    </section>
  );
}

function Panel({ title, badge, children }: { title: string; badge?: SourceLabel | string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        {badge ? typeof badge === "string" && isSourceLabel(badge) ? <SourceBadge source={badge} /> : <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">{badge}</span> : null}
      </div>
      {children}
    </section>
  );
}

function HoldingList({ holdings, emptyText }: { holdings: HoldingItem[]; emptyText: string }) {
  if (!holdings.length) return <EmptyState text={emptyText} />;

  return (
    <div className="space-y-3">
      {holdings.map((holding) => (
        <div key={`${holding.accountName}-${holding.ticker}`} className="rounded-md border border-line bg-panel px-3 py-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-semibold text-ink">{holding.ticker}</p>
              <p className="text-xs text-muted">{holding.accountName}</p>
            </div>
            <span className={holding.unrealizedPLPercent >= 0 ? "font-semibold text-green-700" : "font-semibold text-red-600"}>
              {formatPercent(holding.unrealizedPLPercent)}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted">
            <span>{formatCurrency(holding.marketValue)}</span>
            <span>仓位 {formatPercent(holding.allocation)}</span>
            <SourceBadge source={holding.source} />
          </div>
        </div>
      ))}
    </div>
  );
}

function AlertCard({ alert }: { alert: AlertItem }) {
  return (
    <article className={`rounded-md border px-3 py-3 text-sm ${alert.riskLevel === "high" ? "border-red-200 bg-red-50" : alert.riskLevel === "medium" ? "border-amber-200 bg-amber-50" : "border-line bg-panel"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-ink">{alert.ticker} - {alert.title}</p>
          <p className="mt-1 text-muted">{alert.message}</p>
        </div>
        <span className={`rounded-md px-2 py-1 text-xs font-semibold ${alert.riskLevel === "high" ? "bg-red-100 text-red-700" : alert.riskLevel === "medium" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"}`}>
          {alert.riskLevel === "high" ? "高风险" : alert.riskLevel === "medium" ? "中风险" : "低风险"}
        </span>
      </div>
      <p className="mt-2 text-xs text-muted">来源：{alert.source === "real" ? "真实数据" : alert.source === "fallback" ? "缓存/fallback数据" : "示例数据"}</p>
    </article>
  );
}

function EventCard({ event }: { event: EventItem }) {
  return (
    <article className="rounded-md border border-line bg-panel px-3 py-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-ink">{event.ticker ? `${event.ticker} - ` : ""}{event.title}</p>
          <p className="mt-1 text-muted">{event.description}</p>
        </div>
        <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">{formatShortDate(event.date)}</span>
      </div>
      <p className="mt-2 text-xs text-muted">来源：{event.source === "real" ? "真实数据" : event.source === "fallback" ? "静态数据" : "示例数据"}</p>
    </article>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="rounded-md border border-line bg-panel px-3 py-6 text-center text-sm text-muted">{text}</p>;
}

function SourceBadge({ source }: { source: SourceLabel }) {
  return <span className={`rounded-md px-2 py-1 text-xs font-semibold ${getSourceClass(source)}`}>{source}</span>;
}

function getSourceClass(source: SourceLabel) {
  if (source === "真实数据") return "bg-green-100 text-green-700";
  if (source === "缓存数据") return "bg-amber-100 text-amber-800";
  if (source === "示例数据") return "bg-purple-100 text-purple-700";
  return "bg-slate-100 text-slate-600";
}

function isSourceLabel(value: string): value is SourceLabel {
  return value === "真实数据" || value === "缓存数据" || value === "静态数据" || value === "示例数据";
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 2 }).format(value);
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric", weekday: "short" }).format(new Date(`${value}T00:00:00`));
}
