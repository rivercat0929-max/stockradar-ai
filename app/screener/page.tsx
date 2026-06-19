"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";

type DataSource = "真实数据" | "缓存数据" | "估算数据" | "示例数据";
type Preset = "growth" | "value" | "ai_strength" | "quality" | "oversold" | "large_cap";

type ScreenerResultItem = {
  ticker: string;
  companyName: string;
  industry: string;
  price: number;
  marketCap: number | null;
  pe: number | null;
  eps: number | null;
  volume: number | null;
  revenueGrowth: number;
  grossMargin: number;
  netMargin: number;
  roe: number;
  aiScore: number;
  rating: string;
  ratingLabel: string;
  matchReasons: string[];
  dataSource: DataSource;
  dataSourceDetails: string[];
  aiSummary: string;
};

type ScreenerResponse = {
  stockPool: string[];
  poolNotice: string;
  results: ScreenerResultItem[];
  errors: Array<{ ticker: string; error: string }>;
  dataNotice: string | null;
  dataSources: {
    real: number;
    cached: number;
    estimated: number;
    mock: number;
  };
};

type FilterState = {
  minMarketCap: string;
  maxMarketCap: string;
  minPe: string;
  maxPe: string;
  minEps: string;
  maxEps: string;
  minRevenueGrowth: string;
  minGrossMargin: string;
  minNetMargin: string;
  minRoe: string;
  industry: string;
  minAiScore: string;
  minVolume: string;
  preset: string;
};

const emptyFilters: FilterState = {
  minMarketCap: "",
  maxMarketCap: "",
  minPe: "",
  maxPe: "",
  minEps: "",
  maxEps: "",
  minRevenueGrowth: "",
  minGrossMargin: "",
  minNetMargin: "",
  minRoe: "",
  industry: "全部",
  minAiScore: "",
  minVolume: "",
  preset: ""
};

const presetButtons: Array<{ key: Preset; label: string; description: string }> = [
  { key: "growth", label: "高成长股", description: "营收增长较快，AI Score 不低" },
  { key: "value", label: "低估值股", description: "PE 较低且 EPS 为正" },
  { key: "ai_strength", label: "AI强势股", description: "AI Score 高于75" },
  { key: "quality", label: "高盈利质量股", description: "高毛利、高净利、高ROE" },
  { key: "oversold", label: "超跌反弹股", description: "保守寻找回弹观察对象" },
  { key: "large_cap", label: "大盘稳健股", description: "大市值且评分不低" }
];

const industries = ["全部", "半导体", "软件", "互联网服务", "互联网零售", "电动车", "公用事业", "零售", "支付", "金融", "医疗保险", "制药", "金融科技", "网络安全", "云计算", "半导体设备", "流媒体", "消费电子"];

export default function ScreenerPage() {
  const [filters, setFilters] = useState<FilterState>({ ...emptyFilters, minAiScore: "60" });
  const [data, setData] = useState<ScreenerResponse | null>(null);
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>("默认按 AI Score 从高到低排序。");
  const [isLoading, setIsLoading] = useState(false);
  const poolLabel = useMemo(() => data?.stockPool.join(", ") ?? "", [data]);

  useEffect(() => {
    runScreener(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runScreener(nextFilters = filters) {
    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/screener?${toSearchParams(nextFilters).toString()}`, { cache: "no-store" });
      const payload = await response.json();
      setData(payload);
      if (!response.ok || payload.errors?.length) setMessage("部分股票数据暂时不可用，已显示可用结果。");
      else if (payload.dataNotice) setMessage(payload.dataNotice);
      else setMessage("筛选完成。");
    } catch {
      setData(null);
      setMessage("选股器暂时不可用，请稍后重试。");
    } finally {
      setIsLoading(false);
    }
  }

  function updateFilter(key: keyof FilterState, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function applyPreset(key: Preset) {
    const nextFilters = { ...filters, preset: key };
    setFilters(nextFilters);
    runScreener(nextFilters);
  }

  function submitFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    runScreener(filters);
  }

  function resetFilters() {
    const nextFilters = { ...emptyFilters, minAiScore: "60" };
    setFilters(nextFilters);
    runScreener(nextFilters);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock Screener V1"
        eyebrow="AI选股器"
        description="按财务条件、行业和 AI Score V2 筛选精选美股股票池。"
        action={
          <button
            type="button"
            onClick={() => runScreener(filters)}
            disabled={isLoading}
            className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "筛选中..." : "刷新结果"}
          </button>
        }
      />

      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink">预设策略</h2>
            <p className="mt-1 text-sm text-muted">点击策略会自动应用一组常用筛选条件。</p>
          </div>
          {data ? (
            <div className="flex flex-wrap gap-2 text-xs">
              <SourceBadge label="真实" count={data.dataSources.real} />
              <SourceBadge label="缓存" count={data.dataSources.cached} />
              <SourceBadge label="估算" count={data.dataSources.estimated} />
              <SourceBadge label="示例" count={data.dataSources.mock} />
            </div>
          ) : null}
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {presetButtons.map((preset) => (
            <button
              key={preset.key}
              type="button"
              onClick={() => applyPreset(preset.key)}
              className={`rounded-md border p-4 text-left transition ${filters.preset === preset.key ? "border-signal bg-blue-50" : "border-line bg-panel hover:border-signal"}`}
            >
              <p className="font-semibold text-ink">{preset.label}</p>
              <p className="mt-1 text-sm text-muted">{preset.description}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-ink">筛选条件</h2>
          <button type="button" onClick={resetFilters} className="rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-muted hover:border-slate-400 hover:text-ink">
            重置
          </button>
        </div>
        <form onSubmit={submitFilters} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <NumberInput label="市值下限" value={filters.minMarketCap} onChange={(value) => updateFilter("minMarketCap", value)} placeholder="100000000000" />
          <NumberInput label="市值上限" value={filters.maxMarketCap} onChange={(value) => updateFilter("maxMarketCap", value)} placeholder="1000000000000" />
          <NumberInput label="PE下限" value={filters.minPe} onChange={(value) => updateFilter("minPe", value)} placeholder="0" />
          <NumberInput label="PE上限" value={filters.maxPe} onChange={(value) => updateFilter("maxPe", value)} placeholder="50" />
          <NumberInput label="EPS下限" value={filters.minEps} onChange={(value) => updateFilter("minEps", value)} placeholder="0" />
          <NumberInput label="EPS上限" value={filters.maxEps} onChange={(value) => updateFilter("maxEps", value)} placeholder="20" />
          <NumberInput label="营收增长率最低%" value={filters.minRevenueGrowth} onChange={(value) => updateFilter("minRevenueGrowth", value)} placeholder="20" />
          <NumberInput label="毛利率最低%" value={filters.minGrossMargin} onChange={(value) => updateFilter("minGrossMargin", value)} placeholder="50" />
          <NumberInput label="净利率最低%" value={filters.minNetMargin} onChange={(value) => updateFilter("minNetMargin", value)} placeholder="15" />
          <NumberInput label="ROE最低%" value={filters.minRoe} onChange={(value) => updateFilter("minRoe", value)} placeholder="15" />
          <label className="text-sm">
            <span className="font-medium text-ink">行业</span>
            <select value={filters.industry} onChange={(event) => updateFilter("industry", event.target.value)} className="mt-1 w-full rounded-md border border-line bg-panel px-3 py-2 outline-none focus:border-signal">
              {industries.map((industry) => <option key={industry} value={industry}>{industry}</option>)}
            </select>
          </label>
          <NumberInput label="AI Score最低分" value={filters.minAiScore} onChange={(value) => updateFilter("minAiScore", value)} placeholder="60" />
          <NumberInput label="成交量最低值" value={filters.minVolume} onChange={(value) => updateFilter("minVolume", value)} placeholder="1000000" />
          <div className="flex items-end">
            <button type="submit" disabled={isLoading} className="w-full rounded-md bg-signal px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60">
              {isLoading ? "筛选中..." : "应用筛选"}
            </button>
          </div>
        </form>
      </section>

      {message ? <p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">{message}</p> : null}

      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink">筛选结果</h2>
            <p className="mt-1 text-sm text-muted">{data?.poolNotice ?? "V1 当前基于精选股票池筛选，后续将扩展至全市场。"}</p>
          </div>
          <p className="text-sm text-muted">结果：{data?.results.length ?? 0} 只</p>
        </div>

        {!data || isLoading ? <p className="rounded-md border border-line bg-panel px-3 py-8 text-center text-sm text-muted">正在读取精选股票池...</p> : null}

        {data && !isLoading && data.results.length === 0 ? (
          <p className="rounded-md border border-line bg-panel px-3 py-8 text-center text-sm text-muted">没有符合条件的股票。可以放宽 AI Score、PE 或行业条件后再试。</p>
        ) : null}

        {data && data.results.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-[1180px] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr>
                  {["股票代码", "公司名称", "行业", "当前价格", "市值", "PE", "EPS", "AI Score", "Rating", "匹配原因", "数据来源"].map((column) => (
                    <th key={column} className="border-b border-line bg-panel px-3 py-3 font-semibold text-muted first:rounded-l-md last:rounded-r-md">{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.results.map((item) => (
                  <>
                    <tr key={item.ticker} className="hover:bg-panel/70">
                      <td className="border-b border-line px-3 py-3 font-semibold text-ink">
                        <button type="button" onClick={() => setExpandedTicker(expandedTicker === item.ticker ? null : item.ticker)} className="font-semibold text-signal hover:text-blue-700">
                          {item.ticker}
                        </button>
                      </td>
                      <td className="border-b border-line px-3 py-3 text-muted">{item.companyName}</td>
                      <td className="border-b border-line px-3 py-3">{item.industry}</td>
                      <td className="border-b border-line px-3 py-3">{formatCurrency(item.price)}</td>
                      <td className="border-b border-line px-3 py-3">{formatMarketCap(item.marketCap)}</td>
                      <td className="border-b border-line px-3 py-3">{formatOptionalNumber(item.pe)}</td>
                      <td className="border-b border-line px-3 py-3">{formatOptionalNumber(item.eps)}</td>
                      <td className="border-b border-line px-3 py-3 font-semibold text-signal">{item.aiScore}/100</td>
                      <td className="border-b border-line px-3 py-3">{item.rating} / {item.ratingLabel}</td>
                      <td className="border-b border-line px-3 py-3 text-muted">{item.matchReasons[0]}</td>
                      <td className="border-b border-line px-3 py-3"><DataSourceBadge source={item.dataSource} /></td>
                    </tr>
                    {expandedTicker === item.ticker ? (
                      <tr key={`${item.ticker}-details`}>
                        <td colSpan={11} className="border-b border-line bg-panel px-4 py-4">
                          <div className="grid gap-4 lg:grid-cols-3">
                            <DetailBlock title="匹配原因" items={item.matchReasons} />
                            <DetailBlock title="财务质量" items={[
                              `营收增长率：${formatPercent(item.revenueGrowth)}`,
                              `毛利率：${formatPercent(item.grossMargin)}`,
                              `净利率：${formatPercent(item.netMargin)}`,
                              `ROE：${formatPercent(item.roe)}`,
                              `成交量：${formatOptionalInteger(item.volume)}`
                            ]} />
                            <DetailBlock title="数据来源" items={item.dataSourceDetails} />
                          </div>
                          <p className="mt-4 rounded-md border border-line bg-white p-3 text-sm text-muted">{item.aiSummary}</p>
                        </td>
                      </tr>
                    ) : null}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {poolLabel ? <p className="mt-4 text-xs text-muted">当前股票池：{poolLabel}</p> : null}
      </section>
    </div>
  );
}

function NumberInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <label className="text-sm">
      <span className="font-medium text-ink">{label}</span>
      <input
        type="number"
        step="any"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-md border border-line bg-panel px-3 py-2 outline-none focus:border-signal"
      />
    </label>
  );
}

function DetailBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-md border border-line bg-white p-4">
      <h3 className="font-semibold text-ink">{title}</h3>
      <ul className="mt-3 space-y-2 text-sm text-muted">
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </div>
  );
}

function SourceBadge({ label, count }: { label: string; count: number }) {
  return <span className="rounded-md bg-slate-100 px-2 py-1 font-semibold text-slate-600">{label} {count}</span>;
}

function DataSourceBadge({ source }: { source: DataSource }) {
  const className = source === "真实数据" ? "bg-green-100 text-green-700" : source === "缓存数据" ? "bg-amber-100 text-amber-800" : source === "估算数据" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700";
  return <span className={`rounded-md px-2 py-1 text-xs font-semibold ${className}`}>{source}</span>;
}

function toSearchParams(filters: FilterState) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value.trim() && !(key === "industry" && value === "全部")) params.set(key, value.trim());
  });
  return params;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
}

function formatOptionalNumber(value: number | null) {
  if (value === null) return "-";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

function formatOptionalInteger(value: number | null) {
  if (value === null) return "-";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatMarketCap(value: number | null) {
  if (value === null) return "-";
  if (value >= 1_000_000_000_000) return `$${formatOptionalNumber(value / 1_000_000_000_000)}T`;
  if (value >= 1_000_000_000) return `$${formatOptionalNumber(value / 1_000_000_000)}B`;
  return `$${formatOptionalNumber(value / 1_000_000)}M`;
}
