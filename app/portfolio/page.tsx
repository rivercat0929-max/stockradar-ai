"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TooltipProps } from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import { PageHeader } from "@/components/page-header";

type PortfolioAnalytics = {
  totalAssets: number;
  holdings: Array<{
    id: string;
    ticker: string;
    companyName: string;
    accountName: string;
    industry: string;
    shares: number;
    currentPrice: number;
    marketValue: number;
    allocationPercent: number;
    beta: number;
  }>;
  industries: Array<{
    industry: string;
    marketValue: number;
    allocationPercent: number;
  }>;
  topThreeAllocationPercent: number;
  hhi: number;
  largestHolding: {
    id: string;
    ticker: string;
    companyName: string;
    accountName: string;
    industry: string;
    marketValue: number;
    allocationPercent: number;
    beta: number;
  } | null;
  largestHoldingRisk: string;
  technologyAllocationPercent: number;
  estimatedBeta: number;
  riskScore: number;
  stressTests: Array<{
    scenario: string;
    drawdownValue: number;
    drawdownPercent: number;
  }>;
  suggestions: string[];
};

const chartColors = ["#2563eb", "#16a34a", "#f59e0b", "#dc2626", "#7c3aed", "#0891b2", "#64748b"];

export default function PortfolioAnalyticsPage() {
  const [data, setData] = useState<PortfolioAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadPortfolioAnalytics();
  }, []);

  async function loadPortfolioAnalytics() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/portfolio", { cache: "no-store" });
      const payload = await response.json();

      if (!response.ok) throw new Error(payload.error ?? "组合分析暂时不可用。");
      setData(payload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "组合分析暂时不可用。");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Portfolio Analytics V1"
        eyebrow="组合分析"
        description="自动读取当前持仓，分析仓位、行业集中度、压力测试和组合风险建议。"
        action={
          <button onClick={loadPortfolioAnalytics} className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
            刷新分析
          </button>
        }
      />

      {isLoading ? <p className="rounded-lg border border-line bg-white p-5 text-sm text-muted shadow-soft">正在加载组合分析...</p> : null}
      {error ? <p className="rounded-lg border border-red-300 bg-red-50 p-5 text-sm text-red-700">{error}</p> : null}

      {data ? (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="总资产" value={formatCad(data.totalAssets)} detail="按当前持仓市值估算" />
            <MetricCard label="组合风险评分" value={`${data.riskScore}/100`} detail={`前三大持仓 ${formatPercent(data.topThreeAllocationPercent)}`} tone={data.riskScore >= 70 ? "risk" : "normal"} />
            <MetricCard
              label="最大持仓"
              value={data.largestHolding ? data.largestHolding.ticker : "-"}
              detail={data.largestHolding ? `${data.largestHolding.accountName} / ${formatPercent(data.largestHolding.allocationPercent)} / ${data.largestHoldingRisk}` : "暂无持仓"}
            />
            <MetricCard label="行业分布" value={`${data.industries.length} 类`} detail={`科技占比 ${formatPercent(data.technologyAllocationPercent)}`} />
          </section>

          <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
            <h2 className="text-lg font-semibold">风险分析</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <RiskItem label="HHI集中度指数" value={formatNumber(data.hhi, 0)} />
              <RiskItem label="最大单一持仓风险" value={data.largestHoldingRisk} />
              <RiskItem label="科技行业集中度" value={formatPercent(data.technologyAllocationPercent)} />
              <RiskItem label="Beta估算" value={formatNumber(data.estimatedBeta, 2)} />
              <RiskItem label="前三大持仓占比" value={formatPercent(data.topThreeAllocationPercent)} />
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <ChartPanel title="仓位分布">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={data.holdings} dataKey="marketValue" nameKey="id" outerRadius={105} label={(item) => `${item.ticker} / ${item.accountName} ${formatPercent(item.allocationPercent)}`}>
                    {data.holdings.map((holding, index) => (
                      <Cell key={holding.id} fill={chartColors[index % chartColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<HoldingTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </ChartPanel>

            <ChartPanel title="行业分布">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.industries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="industry" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={(value) => `${value}%`} />
                  <Tooltip formatter={(value) => formatPercent(Number(value))} />
                  <Bar dataKey="allocationPercent" name="行业占比" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartPanel>
          </section>

          <section className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
            <ChartPanel title="压力测试">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.stressTests}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="scenario" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={(value) => `${value}%`} />
                  <Tooltip formatter={(value) => formatPercent(Number(value))} />
                  <Bar dataKey="drawdownPercent" name="预估回撤" fill="#dc2626" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartPanel>

            <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
              <h2 className="text-lg font-semibold">AI 建议</h2>
              <div className="mt-4 space-y-3">
                {data.suggestions.map((suggestion) => (
                  <p key={suggestion} className="rounded-md border border-line bg-panel px-3 py-3 text-sm text-muted">
                    {suggestion}
                  </p>
                ))}
              </div>
            </section>
          </section>

          <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
            <h2 className="text-lg font-semibold">持仓明细</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-[900px] border-separate border-spacing-0 text-left text-sm">
                <thead>
                  <tr>
                    {["股票", "账户", "行业", "市值", "仓位", "价格", "Beta"].map((column) => (
                      <th key={column} className="border-b border-line bg-panel px-3 py-3 font-semibold text-muted first:rounded-l-md last:rounded-r-md">
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.holdings.map((holding) => (
                    <tr key={holding.id} className="hover:bg-panel/70">
                      <td className="border-b border-line px-3 py-3 font-semibold">{holding.ticker}</td>
                      <td className="border-b border-line px-3 py-3 text-muted">{holding.accountName}</td>
                      <td className="border-b border-line px-3 py-3 text-muted">{holding.industry}</td>
                      <td className="border-b border-line px-3 py-3">{formatCad(holding.marketValue)}</td>
                      <td className="border-b border-line px-3 py-3">{formatPercent(holding.allocationPercent)}</td>
                      <td className="border-b border-line px-3 py-3">{formatCad(holding.currentPrice)}</td>
                      <td className="border-b border-line px-3 py-3">{formatNumber(holding.beta, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}

function MetricCard({ label, value, detail, tone = "normal" }: { label: string; value: string; detail: string; tone?: "normal" | "risk" }) {
  return (
    <div className="rounded-lg border border-line bg-white p-5 shadow-soft">
      <p className="text-sm text-muted">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${tone === "risk" ? "text-red-600" : "text-ink"}`}>{value}</p>
      <p className="mt-2 text-sm text-muted">{detail}</p>
    </div>
  );
}

function ChartPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function RiskItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-panel p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 text-lg font-semibold text-ink">{value}</p>
    </div>
  );
}

function formatCad(value: number) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 2
  }).format(value);
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatNumber(value: number, digits: number) {
  return new Intl.NumberFormat("en-CA", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(value);
}

function HoldingTooltip({ active, payload }: TooltipProps<ValueType, NameType>) {
  if (!active || !payload?.length) return null;

  const holding = payload[0].payload as PortfolioAnalytics["holdings"][number];

  return (
    <div className="rounded-md border border-line bg-white px-3 py-2 text-sm shadow-soft">
      <p className="font-semibold text-ink">{holding.ticker} / {holding.accountName}</p>
      <p className="text-signal">市值：{formatCad(holding.marketValue)}</p>
      <p className="text-muted">仓位：{formatPercent(holding.allocationPercent)}</p>
    </div>
  );
}
