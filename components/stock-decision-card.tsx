import { DataSourceBadge } from "@/components/data-source-badge";
import type { StockDecision, StockDecisionStatus } from "@/lib/stock-decision";

const statusLabels: Record<StockDecisionStatus, string> = {
  buy_in_batches: "分批买入",
  wait_for_pullback: "等待回调",
  hold: "继续持有",
  consider_reduce: "考虑减仓",
  high_risk: "风险较高",
  insufficient_data: "数据不足"
};

export function StockDecisionCard({ decision, compact = false }: { decision: StockDecision; compact?: boolean }) {
  return (
    <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-signal">当前决策</p>
          <h2 className="mt-1 text-2xl font-bold tracking-normal text-ink">{decision.symbol} · {statusLabels[decision.status]}</h2>
          <p className="mt-2 text-sm leading-6 text-muted">{decision.summary}</p>
        </div>
        <span className={`rounded-md px-3 py-1 text-sm font-semibold ${statusClass(decision.status)}`}>{statusLabels[decision.status]}</span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="当前价" value={moneyOrDash(decision.currentPrice)} />
        <Metric label="成本" value={decision.averageCost === null ? "未持有" : moneyOrDash(decision.averageCost)} />
        <Metric label="盈亏" value={percentOrDash(decision.returnPercent)} />
        <Metric label="仓位" value={percentOrDash(decision.positionWeight)} />
      </div>

      {!compact ? (
        <>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <ReasonList title="主要支持理由" items={decision.supportingReasons} empty="暂无足够支持理由。" tone="support" />
            <ReasonList title="主要风险" items={decision.riskReasons} empty="暂未触发明确风险。" tone="risk" />
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <PlanPanel title="我的计划" rows={[
              ["买入区间", range(decision.plan.buyZoneLow, decision.plan.buyZoneHigh)],
              ["第一/第二加仓价", pair(decision.plan.addPrice1, decision.plan.addPrice2)],
              ["风险控制价", moneyOrDash(decision.plan.riskControlPrice)],
              ["第一/第二目标价", pair(decision.plan.targetPrice1, decision.plan.targetPrice2)],
              ["最大计划仓位", percentOrDash(decision.plan.maxPositionWeight)]
            ]} />
            <PlanPanel title="系统参考" rows={[
              ["参考买入区", range(decision.systemReference.buyZoneLow, decision.systemReference.buyZoneHigh)],
              ["近期支撑/压力", pair(decision.systemReference.supportPrice, decision.systemReference.resistancePrice)],
              ["参考风险价", moneyOrDash(decision.systemReference.riskControlPrice)],
              ["参考目标区", pair(decision.systemReference.targetPrice1, decision.systemReference.targetPrice2)]
            ]} notes={decision.systemReference.notes} />
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <section className="rounded-md border border-line bg-panel p-4">
              <h3 className="font-semibold text-ink">投资逻辑与失效条件</h3>
              <p className="mt-2 text-sm text-muted">{decision.thesis ?? "尚未填写投资逻辑。"}</p>
              <ul className="mt-3 space-y-2 text-sm text-muted">
                {(decision.invalidationConditions.length ? decision.invalidationConditions : ["尚未填写逻辑失效条件。"]).map((item) => <li key={item}>• {item}</li>)}
              </ul>
            </section>
            <section className="rounded-md border border-line bg-panel p-4">
              <h3 className="font-semibold text-ink">财报和事件风险</h3>
              {decision.events.length ? (
                <div className="mt-3 space-y-2">
                  {decision.events.slice(0, 3).map((event) => (
                    <p key={`${event.type}-${event.startAt}-${event.title}`} className="text-sm text-muted">{formatDate(event.startAt)} · {event.title} · {event.sourceName}</p>
                  ))}
                </div>
              ) : <p className="mt-2 text-sm text-muted">未来7天暂无持仓相关事件。</p>}
            </section>
          </div>
        </>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-muted">
        <span>覆盖率 {(decision.dataCoverage * 100).toFixed(0)}%</span>
        <span>可信度 {decision.confidence}</span>
        <span>更新 {decision.dataUpdatedAt ? formatDateTime(decision.dataUpdatedAt) : "--"}</span>
        <DataSourceBadge quote={decision.quote} />
      </div>
      {decision.warnings.length ? <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{decision.warnings[0]}</p> : null}
    </section>
  );
}

export function DecisionStatusBadge({ status }: { status: StockDecisionStatus }) {
  return <span className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${statusClass(status)}`}>{statusLabels[status]}</span>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border border-line bg-panel p-3"><p className="text-xs text-muted">{label}</p><p className="mt-1 font-semibold text-ink">{value}</p></div>;
}

function ReasonList({ title, items, empty, tone }: { title: string; items: string[]; empty: string; tone: "support" | "risk" }) {
  const className = tone === "support" ? "border-green-200 bg-green-50 text-green-800" : "border-amber-200 bg-amber-50 text-amber-900";
  return <section><h3 className="mb-2 font-semibold text-ink">{title}</h3><div className="space-y-2">{(items.length ? items : [empty]).slice(0, 3).map((item) => <p key={item} className={`rounded-md border px-3 py-2 text-sm ${className}`}>{item}</p>)}</div></section>;
}

function PlanPanel({ title, rows, notes = [] }: { title: string; rows: Array<[string, string]>; notes?: string[] }) {
  return (
    <section className="rounded-md border border-line bg-panel p-4">
      <h3 className="font-semibold text-ink">{title}</h3>
      <div className="mt-3 grid gap-2 text-sm">
        {rows.map(([label, value]) => <div key={label} className="flex justify-between gap-3"><span className="text-muted">{label}</span><span className="font-medium text-ink">{value}</span></div>)}
      </div>
      {notes.length ? <p className="mt-3 text-xs leading-5 text-muted">{notes.join("；")}</p> : null}
    </section>
  );
}

function statusClass(status: StockDecisionStatus) {
  if (status === "buy_in_batches") return "bg-green-100 text-green-700";
  if (status === "wait_for_pullback") return "bg-blue-100 text-blue-700";
  if (status === "hold") return "bg-slate-100 text-slate-700";
  if (status === "consider_reduce") return "bg-amber-100 text-amber-800";
  if (status === "high_risk") return "bg-red-100 text-red-700";
  return "bg-slate-100 text-slate-500";
}

function range(low: number | null, high: number | null) {
  return low === null && high === null ? "--" : `${moneyOrDash(low)} - ${moneyOrDash(high)}`;
}

function pair(first: number | null, second: number | null) {
  return first === null && second === null ? "--" : `${moneyOrDash(first)} / ${moneyOrDash(second)}`;
}

function moneyOrDash(value: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value) : "--";
}

function percentOrDash(value: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? `${value >= 0 ? "+" : ""}${value.toFixed(2)}%` : "--";
}

function formatDate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric" }).format(parsed);
}

function formatDateTime(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "--" : new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(parsed);
}
