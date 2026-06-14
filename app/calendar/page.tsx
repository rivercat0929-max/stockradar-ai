"use client";

import { DataTable } from "@/components/data-table";
import { Disclaimer } from "@/components/disclaimer";
import { useLanguage } from "@/components/language-provider";
import { PageHeader } from "@/components/page-header";
import { events } from "@/lib/mock-data";

export default function CalendarPage() {
  const { t } = useLanguage();

  return (
    <div className="space-y-6">
      <PageHeader title={t("calendar")} eyebrow="Next 7 Days" description={t("calendarDescription")} />

      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <DataTable
          columns={[t("date"), t("type"), t("target"), t("event"), t("expectedImpact"), t("priority")]}
          rows={events.map((event) => [
            event.date,
            event.type,
            event.ticker ?? t("macro"),
            event.title,
            event.expectedImpact,
            event.priority
          ])}
        />
      </section>

      <Disclaimer />
    </div>
  );
}
