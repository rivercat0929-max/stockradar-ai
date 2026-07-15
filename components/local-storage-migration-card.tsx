"use client";

import { useEffect, useState } from "react";
import { getLocalStorageMigrationSummary, markMigrationSkipped, migrateLocalStorageToSupabase } from "@/lib/migrations/local-storage-to-supabase";

type Summary = ReturnType<typeof getLocalStorageMigrationSummary>;

export function LocalStorageMigrationCard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isMigrating, setIsMigrating] = useState(false);

  useEffect(() => setSummary(getLocalStorageMigrationSummary()), []);

  if (!summary || summary.status === "completed" || summary.status === "skipped") return null;
  if (!summary.holdingsCount && !summary.watchlistCount && !summary.settingsFound) return null;

  async function migrate() {
    setIsMigrating(true);
    const result = await migrateLocalStorageToSupabase();
    setSummary(getLocalStorageMigrationSummary());
    setMessage(`迁移完成：成功 ${result.imported} 条，失败 ${result.failed} 条，跳过 ${result.skipped} 条。本地备份已保留。`);
    setIsMigrating(false);
  }

  function skip() {
    markMigrationSkipped();
    setSummary(getLocalStorageMigrationSummary());
  }

  return (
    <section className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
      <h2 className="font-semibold">发现本地旧数据</h2>
      <p className="mt-1">持仓 {summary.holdingsCount} 条，自选股 {summary.watchlistCount} 条，设置：{summary.settingsFound ? "有" : "无"}。</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={migrate} disabled={isMigrating} className="rounded-md bg-amber-700 px-3 py-2 font-semibold text-white disabled:opacity-60">{isMigrating ? "正在迁移..." : "迁移到云端"}</button>
        <button onClick={skip} className="rounded-md border border-amber-400 px-3 py-2 font-semibold">暂不迁移</button>
      </div>
      {message ? <p className="mt-3">{message}</p> : null}
    </section>
  );
}
