"use client";

import { useLanguage } from "@/components/language-provider";
import type { DailyBriefing } from "@/lib/types";

export function BriefingPanel({ briefing }: { briefing: DailyBriefing }) {
  const { t } = useLanguage();
  const sections: [string, string[]][] = [
    [t("marketBrief"), [t("briefMarket1"), t("briefMarket2")]],
    [t("portfolioRisk"), [t("briefRisk1"), t("briefRisk2")]],
    [t("todayOpportunities"), [t("briefOpp1"), t("briefOpp2")]],
    [t("risksToday"), [t("briefTodayRisk1"), t("briefTodayRisk2")]],
    [t("upcomingEvents"), briefing.upcomingEvents]
  ];

  return (
    <div className="rounded-lg border border-line bg-white p-5 shadow-soft">
      <h2 className="text-lg font-semibold">{t("aiBriefing")}</h2>
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
