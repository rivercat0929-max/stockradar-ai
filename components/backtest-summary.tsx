import type { BacktestResult } from "@/lib/types";

export function BacktestSummary({ result }: { result: BacktestResult }) {
  return (
    <div className="rounded-lg border border-line bg-white p-5 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">历史相似信号</h2>
          <p className="mt-1 text-sm text-muted">{result.ticker} · {result.signalType}</p>
        </div>
        <span className="rounded bg-ink px-3 py-1 text-sm font-semibold text-white">{result.signalGrade}</span>
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-3">
        <Stat label="样本数量" value={`${result.sampleSize} 次`} />
        <Stat label="20 日胜率" value={`${result.winRate20d}%`} />
        <Stat label="平均收益" value={`${result.avgReturn20d}%`} />
        <Stat label="最大回撤" value={`${result.maxDrawdown}%`} />
        <Stat label="5 日胜率" value={`${result.winRate5d}%`} />
        <Stat label="60 日胜率" value={`${result.winRate60d}%`} />
      </dl>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-panel p-3">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="mt-1 font-semibold">{value}</dd>
    </div>
  );
}
