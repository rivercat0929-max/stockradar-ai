import type { DailyBriefing } from "@/lib/types";

export function BriefingPanel({ briefing }: { briefing: DailyBriefing }) {
  const sections: [string, string[]][] = [
    ["今日市场状态", briefing.market],
    ["我的持仓风险", briefing.portfolioRisk],
    ["今日机会", briefing.opportunities],
    ["今日风险", briefing.risks],
    ["未来 7 天事件", briefing.upcomingEvents]
  ];

  return (
    <div className="rounded-lg border border-line bg-white p-5 shadow-soft">
      <h2 className="text-lg font-semibold">每日 AI 投资简报</h2>
      <div className="mt-4 space-y-4">
        {sections.map(([title, items]) => (
          <section key={title}>
            <h3 className="text-sm font-semibold text-muted">{title}</h3>
            <ul className="mt-2 space-y-2">
              {items.map((item) => (
                <li key={item} className="rounded-md bg-panel px-3 py-2 text-sm">{item}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
