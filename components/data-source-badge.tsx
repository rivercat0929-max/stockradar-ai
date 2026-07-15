import type { MarketDataSource, MarketQuote } from "@/lib/market-data";

export function DataSourceBadge({ quote, source, updatedAt, className = "" }: { quote?: MarketQuote | null; source?: MarketDataSource; updatedAt?: string | null; className?: string }) {
  const dataSource = quote?.source ?? source ?? "unavailable";
  const time = quote?.updatedAt ?? updatedAt ?? null;
  const label = getSourceLabel(dataSource, quote?.originalSource ?? null);
  const warning = dataSource === "stale-cache" ? "数据可能已过期" : null;

  return (
    <span className={`inline-flex flex-col rounded-md border px-2 py-1 text-xs leading-5 ${getBadgeClass(dataSource)} ${className}`}>
      <span className="font-semibold">{label}</span>
      <span>{time ? `更新于 ${formatRelativeTime(time)}` : "更新时间不可用"}</span>
      {warning ? <span>{warning}</span> : null}
    </span>
  );
}

function getSourceLabel(source: MarketDataSource, originalSource: "fmp" | "yahoo" | null) {
  if (source === "fmp") return "真实数据 · FMP";
  if (source === "yahoo") return "真实数据 · Yahoo";
  if (source === "cache") return originalSource === "yahoo" ? "缓存数据 · Yahoo" : "缓存数据";
  if (source === "stale-cache") return "过期缓存";
  if (source === "mock") return "示例数据";
  return "暂无数据";
}

function getBadgeClass(source: MarketDataSource) {
  if (source === "fmp" || source === "yahoo") return "border-green-200 bg-green-50 text-green-700";
  if (source === "cache") return "border-blue-200 bg-blue-50 text-blue-700";
  if (source === "stale-cache") return "border-amber-200 bg-amber-50 text-amber-800";
  if (source === "mock") return "border-slate-200 bg-slate-100 text-slate-600";
  return "border-slate-200 bg-white text-slate-500";
}

function formatRelativeTime(value: string) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "未知时间";
  const diffMs = Math.max(0, Date.now() - timestamp);
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  return `${Math.floor(hours / 24)}天前`;
}
