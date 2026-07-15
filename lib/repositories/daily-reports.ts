import { eq, hasSupabaseAdmin, order, supabaseAdminRequest } from "@/lib/supabase/admin";
import { RepositoryError } from "@/lib/repositories/shared";
import type { Json, SupabaseDailyReportRow } from "@/lib/types/database";

export async function getDailyReports(userId: string) {
  if (!hasSupabaseAdmin()) throw new RepositoryError("Supabase 未配置。");
  return supabaseAdminRequest<SupabaseDailyReportRow[]>(`daily_reports?${eq("user_id", userId)}&${order("report_date", "desc")}`);
}

export async function upsertDailyReport(userId: string, reportDate: string, reportContent: unknown, summaryText?: string | null) {
  const rows = await supabaseAdminRequest<SupabaseDailyReportRow[]>("daily_reports?on_conflict=user_id,report_date", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({
      user_id: userId,
      report_date: reportDate,
      report_content: reportContent as Json,
      summary_text: summaryText ?? null
    })
  });
  return rows[0];
}
