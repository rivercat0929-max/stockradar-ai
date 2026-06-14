import { BriefingPanel } from "@/components/briefing-panel";
import { DataTable } from "@/components/data-table";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { ScoreBadge } from "@/components/score-badge";
import { Disclaimer } from "@/components/disclaimer";
import { alerts, dailyBriefing, holdings, marketStatus, stocks } from "@/lib/mock-data";
import { getPortfolioSummary } from "@/lib/portfolio";

export default function DashboardPage() {
  const summary = getPortfolioSummary(holdings);
  const opportunities = stocks.filter((stock) => stock.score.totalScore >= 76).slice(0, 4);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard 首页"
        eyebrow="StockRadar AI"
        description="今日市场状态、组合风险、重要提醒和 AI 简报集中在这里。"
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="今日市场状态" value={marketStatus.label} detail={marketStatus.summary} tone="blue" />
        <MetricCard label="组合总市值" value={`$${summary.totalValue.toLocaleString()}`} detail={`今日盈亏 ${summary.dayChangePercent}%`} tone="green" />
        <MetricCard label="最大单股占比" value={`${summary.largestHolding.ticker} ${summary.largestHolding.allocation}%`} detail="目标低于 35% 更稳健" tone="amber" />
        <MetricCard label="组合风险等级" value={summary.riskLevel} detail={summary.riskNotes[0]} tone="red" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-lg border border-line bg-white p-5 shadow-soft">
          <h2 className="text-lg font-semibold">今日重要提醒</h2>
          <div className="mt-4 space-y-3">
            {alerts.slice(0, 4).map((alert) => (
              <div key={alert.id} className="flex gap-3 rounded-md border border-line bg-panel p-3">
                <span className="h-fit rounded bg-ink px-2 py-1 text-xs font-semibold text-white">{alert.priority}</span>
                <div>
                  <p className="font-medium">{alert.title}</p>
                  <p className="mt-1 text-sm text-muted">{alert.content}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <BriefingPanel briefing={dailyBriefing} />
      </section>

      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">今日机会</h2>
          <span className="text-sm text-muted">基于 mock 评分规则</span>
        </div>
        <DataTable
          columns={["股票", "公司", "总分", "状态", "操作建议"]}
          rows={opportunities.map((stock) => [
            stock.ticker,
            stock.companyName,
            <ScoreBadge key={`${stock.ticker}-score`} score={stock.score.totalScore} />,
            stock.status,
            stock.recommendation
          ])}
        />
      </section>

      <Disclaimer />
    </div>
  );
}
