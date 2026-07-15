"use client";

export type DataSyncState = "syncing" | "synced" | "migration-pending" | "cloud-unavailable" | "local-backup" | "failed";

const labels: Record<DataSyncState, string> = {
  syncing: "正在同步",
  synced: "已同步",
  "migration-pending": "本地数据待迁移",
  "cloud-unavailable": "云端暂时不可用",
  "local-backup": "使用本地备份",
  failed: "同步失败"
};

const classes: Record<DataSyncState, string> = {
  syncing: "border-blue-200 bg-blue-50 text-blue-700",
  synced: "border-green-200 bg-green-50 text-green-700",
  "migration-pending": "border-amber-200 bg-amber-50 text-amber-800",
  "cloud-unavailable": "border-red-200 bg-red-50 text-red-700",
  "local-backup": "border-slate-200 bg-slate-50 text-slate-700",
  failed: "border-red-200 bg-red-50 text-red-700"
};

export function DataSyncStatus({ state, detail }: { state: DataSyncState; detail?: string | null }) {
  return (
    <div className={`inline-flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm ${classes[state]}`}>
      <span className="font-semibold">{labels[state]}</span>
      {detail ? <span>{detail}</span> : null}
    </div>
  );
}
