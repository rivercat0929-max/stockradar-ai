import Link from "next/link";
import { DataTable } from "@/components/data-table";
import { Disclaimer } from "@/components/disclaimer";
import { PageHeader } from "@/components/page-header";
import { ScoreBadge } from "@/components/score-badge";
import { stocks } from "@/lib/mock-data";
import { gradeFromScore } from "@/lib/scoring";

export default function RadarPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="选股雷达"
        eyebrow="Radar"
        description="按综合评分、基本面、估值和技术面快速扫描机会。"
      />

      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <div className="mb-4 flex flex-wrap gap-2">
          {["成长股", "估值合理", "技术突破", "财报超预期"].map((filter) => (
            <span key={filter} className="rounded bg-panel px-3 py-1 text-sm font-medium text-muted">{filter}</span>
          ))}
        </div>
        <DataTable
          columns={["股票", "公司", "总分", "基本面", "估值", "技术", "状态", "操作建议", "详情"]}
          rows={stocks.map((stock) => [
            stock.ticker,
            stock.companyName,
            <ScoreBadge key={`${stock.ticker}-score`} score={stock.score.totalScore} />,
            gradeFromScore(stock.score.fundamentalScore),
            gradeFromScore(stock.score.valuationScore),
            gradeFromScore(stock.score.technicalScore),
            stock.status,
            stock.recommendation,
            <Link key={`${stock.ticker}-link`} href={`/stocks/${stock.ticker}`} className="text-sm font-semibold text-signal">查看</Link>
          ])}
        />
      </section>

      <Disclaimer />
    </div>
  );
}
