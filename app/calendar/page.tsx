import { DataTable } from "@/components/data-table";
import { Disclaimer } from "@/components/disclaimer";
import { PageHeader } from "@/components/page-header";
import { events } from "@/lib/mock-data";

export default function CalendarPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="事件日历"
        eyebrow="Next 7 Days"
        description="集中展示财报、分红、CPI、PPI、FOMC、GDP 和公司公告。"
      />

      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <DataTable
          columns={["日期", "类型", "标的", "事件", "预计影响", "优先级"]}
          rows={events.map((event) => [
            event.date,
            event.type,
            event.ticker ?? "宏观",
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
