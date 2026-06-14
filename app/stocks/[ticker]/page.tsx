import Link from "next/link";
import { notFound } from "next/navigation";
import { BacktestSummary } from "@/components/backtest-summary";
import { Disclaimer } from "@/components/disclaimer";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { ScoreBadge } from "@/components/score-badge";
import { backtests, stocks } from "@/lib/mock-data";
import { gradeFromScore } from "@/lib/scoring";

export function generateStaticParams() {
  return stocks.map((stock) => ({ ticker: stock.ticker }));
}

export default function StockDetailPage({ params }: { params: { ticker: string } }) {
  const stock = stocks.find((item) => item.ticker === params.ticker.toUpperCase());
  if (!stock) notFound();
  const backtest = backtests.find((item) => item.ticker === stock.ticker);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${stock.ticker} ${stock.companyName}`}
        eyebrow="股票详情"
        description={stock.analysis}
        action={<Link href="/radar" className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white">返回雷达</Link>}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <MetricCard label="综合评分" value={<ScoreBadge score={stock.score.totalScore} />} detail={gradeFromScore(stock.score.totalScore)} />
        <MetricCard label="基本面" value={stock.score.fundamentalScore} detail={gradeFromScore(stock.score.fundamentalScore)} />
        <MetricCard label="估值" value={stock.score.valuationScore} detail={gradeFromScore(stock.score.valuationScore)} />
        <MetricCard label="技术面" value={stock.score.technicalScore} detail={gradeFromScore(stock.score.technicalScore)} />
        <MetricCard label="催化因素" value={stock.score.catalystScore} detail={gradeFromScore(stock.score.catalystScore)} />
        <MetricCard label="风险评分" value={stock.score.riskScore} detail="越高越稳" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <div className="rounded-lg border border-line bg-white p-5 shadow-soft">
          <h2 className="text-lg font-semibold">当前结论</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Info label="结论" value={stock.conclusion} />
            <Info label="买入区" value={stock.buyZone} />
            <Info label="卖出 / 减仓区" value={stock.sellZone} />
            <Info label="逻辑失效点" value={stock.invalidPoint} />
          </div>
        </div>
        {backtest ? <BacktestSummary result={backtest} /> : null}
      </section>

      <Disclaimer emphasized />
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-panel p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 font-semibold">{value}</p>
    </div>
  );
}
