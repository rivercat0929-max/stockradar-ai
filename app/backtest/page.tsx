import { BacktestSummary } from "@/components/backtest-summary";
import { DataTable } from "@/components/data-table";
import { Disclaimer } from "@/components/disclaimer";
import { PageHeader } from "@/components/page-header";
import { backtests } from "@/lib/mock-data";

export default function BacktestPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="回测实验室"
        eyebrow="Backtest Lab"
        description="MVP 先展示历史相似信号的样本、胜率、平均收益和最大回撤。"
      />

      <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <BacktestSummary result={backtests[0]} />
        <div className="rounded-lg border border-line bg-white p-5 shadow-soft">
          <DataTable
            columns={["股票", "信号类型", "样本", "5 日胜率", "20 日胜率", "60 日胜率", "平均收益", "最大回撤", "等级"]}
            rows={backtests.map((result) => [
              result.ticker,
              result.signalType,
              result.sampleSize,
              `${result.winRate5d}%`,
              `${result.winRate20d}%`,
              `${result.winRate60d}%`,
              `${result.avgReturn20d}%`,
              `${result.maxDrawdown}%`,
              result.signalGrade
            ])}
          />
        </div>
      </section>

      <Disclaimer />
    </div>
  );
}
