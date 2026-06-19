"use client";

import { useState } from "react";
import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { PageHeader } from "@/components/page-header";

type BuyRule = "ai_score_gt_80" | "break_above_ma20" | "break_above_ma50" | "rsi_below_30";
type SellRule = "break_below_ma20" | "break_below_ma50" | "stop_loss_10" | "take_profit_30";

type BacktestPoint = {
  date: string;
  close: number;
  equity: number;
  drawdown: number;
  ma20: number | null;
  ma50: number | null;
  rsi: number | null;
  marker?: "buy" | "sell";
};

type BacktestTrade = {
  entryDate: string;
  exitDate: string;
  entryPrice: number;
  exitPrice: number;
  shares: number;
  returnPercent: number;
  exitReason: string;
};

type BacktestResult = {
  ticker: string;
  startDate: string;
  endDate: string;
  initialCapital: number;
  finalEquity: number;
  totalReturn: number;
  annualizedReturn: number;
  maxDrawdown: number;
  winRate: number;
  tradeCount: number;
  strategyEvaluation: string;
  aiScoreUsed: number | null;
  aiScoreNotice: string;
  dataSource: string;
  equityCurve: BacktestPoint[];
  trades: BacktestTrade[];
  warnings: string[];
};

const buyRuleOptions: Array<{ value: BuyRule; label: string }> = [
  { value: "ai_score_gt_80", label: "AI Score > 80" },
  { value: "break_above_ma20", label: "价格突破20日均线" },
  { value: "break_above_ma50", label: "价格突破50日均线" },
  { value: "rsi_below_30", label: "RSI < 30" }
];

const sellRuleOptions: Array<{ value: SellRule; label: string }> = [
  { value: "break_below_ma20", label: "跌破20日均线" },
  { value: "break_below_ma50", label: "跌破50日均线" },
  { value: "stop_loss_10", label: "止损 -10%" },
  { value: "take_profit_30", label: "止盈 +30%" }
];

export default function BacktestPage() {
  const [ticker, setTicker] = useState("NVDA");
  const [startDate, setStartDate] = useState("2023-01-01");
  const [endDate, setEndDate] = useState("2025-12-31");
  const [initialCapital, setInitialCapital] = useState("10000");
  const [buyRules, setBuyRules] = useState<BuyRule[]>(["break_above_ma20"]);
  const [sellRules, setSellRules] = useState<SellRule[]>(["break_below_ma20", "stop_loss_10", "take_profit_30"]);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function runStrategy(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/backtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker,
          startDate,
          endDate,
          initialCapital: Number(initialCapital),
          buyRules,
          sellRules
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "历史数据暂不可用");
      setResult(payload);
    } catch (runError) {
      setResult(null);
      setError(runError instanceof Error ? runError.message : "历史数据暂不可用");
    } finally {
      setIsLoading(false);
    }
  }

  function toggleBuyRule(rule: BuyRule) {
    setBuyRules((current) => current.includes(rule) ? current.filter((item) => item !== rule) : [...current, rule]);
  }

  function toggleSellRule(rule: SellRule) {
    setSellRules((current) => current.includes(rule) ? current.filter((item) => item !== rule) : [...current, rule]);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Backtest Engine V1"
        eyebrow="策略回测"
        description="测试简单投资策略的历史表现。V1 使用真实历史价格和简化交易模型。"
      />

      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <form onSubmit={runStrategy} className="grid gap-5 lg:grid-cols-[1fr_1fr]">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput label="股票代码" value={ticker} onChange={(value) => setTicker(value.toUpperCase())} />
            <TextInput label="初始资金" value={initialCapital} onChange={setInitialCapital} type="number" />
            <TextInput label="回测开始日期" value={startDate} onChange={setStartDate} type="date" />
            <TextInput label="回测结束日期" value={endDate} onChange={setEndDate} type="date" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <RuleGroup title="买入规则" options={buyRuleOptions} selected={buyRules} onToggle={toggleBuyRule} />
            <RuleGroup title="卖出规则" options={sellRuleOptions} selected={sellRules} onToggle={toggleSellRule} />
          </div>

          <div className="lg:col-span-2">
            <button
              type="submit"
              disabled={isLoading}
              className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? "正在回测..." : "开始回测"}
            </button>
          </div>
        </form>
      </section>

      {error ? <p className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700">{error}</p> : null}

      {result ? (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <Metric title="总收益率" value={formatPercent(result.totalReturn)} tone={result.totalReturn >= 0 ? "positive" : "negative"} />
            <Metric title="年化收益率" value={formatPercent(result.annualizedReturn)} tone={result.annualizedReturn >= 0 ? "positive" : "negative"} />
            <Metric title="最大回撤" value={formatPercent(result.maxDrawdown)} tone="negative" />
            <Metric title="胜率" value={formatPercent(result.winRate)} />
            <Metric title="交易次数" value={`${result.tradeCount} 次`} />
          </section>

          <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-ink">当前策略评价</h2>
                <p className="mt-1 text-sm text-muted">{result.strategyEvaluation}</p>
              </div>
              <div className="text-sm text-muted">
                <p>数据来源：{result.dataSource}</p>
                <p>当前AI Score：{result.aiScoreUsed ?? "不可用"}</p>
              </div>
            </div>
            <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">{result.aiScoreNotice}</p>
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <ChartPanel title="资金曲线与买卖点">
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={result.equityCurve}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" minTickGap={28} />
                  <YAxis tickFormatter={(value) => `$${Number(value).toLocaleString()}`} />
                  <Tooltip formatter={(value) => typeof value === "number" ? formatCurrency(value) : value} />
                  <Legend />
                  <Line type="monotone" dataKey="equity" name="资金曲线" stroke="#2563eb" strokeWidth={2} dot={false} />
                  {result.equityCurve.filter((point) => point.marker).map((point) => (
                    <ReferenceDot
                      key={`${point.date}-${point.marker}`}
                      x={point.date}
                      y={point.equity}
                      r={5}
                      fill={point.marker === "buy" ? "#16a34a" : "#dc2626"}
                      stroke="none"
                    />
                  ))}
                </ComposedChart>
              </ResponsiveContainer>
            </ChartPanel>

            <ChartPanel title="回撤曲线">
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={result.equityCurve}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" minTickGap={28} />
                  <YAxis tickFormatter={(value) => `${value}%`} />
                  <Tooltip formatter={(value) => typeof value === "number" ? `${value.toFixed(2)}%` : value} />
                  <Legend />
                  <Line type="monotone" dataKey="drawdown" name="回撤" stroke="#dc2626" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartPanel>
          </section>

          <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
            <h2 className="mb-4 text-lg font-semibold text-ink">交易记录</h2>
            {result.trades.length ? (
              <div className="overflow-x-auto">
                <table className="min-w-[840px] border-separate border-spacing-0 text-left text-sm">
                  <thead>
                    <tr>
                      {["买入日期", "卖出日期", "买入价", "卖出价", "收益率", "卖出原因"].map((column) => (
                        <th key={column} className="border-b border-line bg-panel px-3 py-3 font-semibold text-muted first:rounded-l-md last:rounded-r-md">{column}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.trades.map((trade, index) => (
                      <tr key={`${trade.entryDate}-${trade.exitDate}-${index}`} className="hover:bg-panel/70">
                        <td className="border-b border-line px-3 py-3">{trade.entryDate}</td>
                        <td className="border-b border-line px-3 py-3">{trade.exitDate}</td>
                        <td className="border-b border-line px-3 py-3">{formatCurrency(trade.entryPrice)}</td>
                        <td className="border-b border-line px-3 py-3">{formatCurrency(trade.exitPrice)}</td>
                        <td className={`border-b border-line px-3 py-3 ${trade.returnPercent >= 0 ? "text-green-600" : "text-red-600"}`}>{formatPercent(trade.returnPercent)}</td>
                        <td className="border-b border-line px-3 py-3 text-muted">{trade.exitReason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="rounded-md border border-line bg-panel px-3 py-6 text-center text-sm text-muted">回测区间内没有交易。</p>
            )}
          </section>
        </>
      ) : null}

      <section className="rounded-lg border border-line bg-white p-5 text-sm text-muted shadow-soft">
        <h2 className="font-semibold text-ink">回测说明</h2>
        <ul className="mt-3 space-y-2">
          <li>回测不代表未来收益。</li>
          <li>V1为简化模型。</li>
          <li>未考虑滑点、税费、汇率、分红。</li>
          <li>结果仅供研究参考。</li>
          <li>AI Score历史回测为规则近似，不代表真实历史AI评分。</li>
        </ul>
      </section>
    </div>
  );
}

function TextInput({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="text-sm">
      <span className="font-medium text-ink">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-md border border-line bg-panel px-3 py-2 outline-none focus:border-signal"
      />
    </label>
  );
}

function RuleGroup<T extends string>({ title, options, selected, onToggle }: { title: string; options: Array<{ value: T; label: string }>; selected: T[]; onToggle: (value: T) => void }) {
  return (
    <div>
      <p className="text-sm font-medium text-ink">{title}</p>
      <div className="mt-2 space-y-2">
        {options.map((option) => (
          <label key={option.value} className="flex items-center gap-2 rounded-md border border-line bg-panel px-3 py-2 text-sm text-muted">
            <input type="checkbox" checked={selected.includes(option.value)} onChange={() => onToggle(option.value)} />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function Metric({ title, value, tone = "neutral" }: { title: string; value: string; tone?: "positive" | "negative" | "neutral" }) {
  return (
    <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
      <p className="text-sm text-muted">{title}</p>
      <p className={`mt-2 text-2xl font-bold ${tone === "positive" ? "text-green-700" : tone === "negative" ? "text-red-600" : "text-ink"}`}>{value}</p>
    </section>
  );
}

function ChartPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
      <h2 className="mb-4 text-lg font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
}

function formatPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}
