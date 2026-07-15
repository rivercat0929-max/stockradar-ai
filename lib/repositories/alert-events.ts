import { eq, hasSupabaseAdmin, order, supabaseAdminRequest } from "@/lib/supabase/admin";
import { normalizeSymbol, RepositoryError } from "@/lib/repositories/shared";
import type { Json, SupabaseAlertEventRow } from "@/lib/types/database";

export async function getAlertEvents(userId: string) {
  if (!hasSupabaseAdmin()) throw new RepositoryError("Supabase 未配置。");
  return supabaseAdminRequest<SupabaseAlertEventRow[]>(`alert_events?${eq("user_id", userId)}&${order("triggered_at", "desc")}`);
}

export async function createAlertEvent(userId: string, input: Record<string, unknown>) {
  const symbol = normalizeSymbol(input.symbol ?? input.ticker);
  if (!symbol) throw new RepositoryError("股票代码不能为空。");
  const rows = await supabaseAdminRequest<SupabaseAlertEventRow[]>("alert_events", {
    method: "POST",
    body: JSON.stringify({
      user_id: userId,
      alert_rule_id: typeof input.alertRuleId === "string" ? input.alertRuleId : null,
      symbol,
      event_type: String(input.eventType ?? "alert"),
      message: String(input.message ?? "预警触发"),
      market_price: typeof input.marketPrice === "number" ? input.marketPrice : null,
      market_data_source: typeof input.marketDataSource === "string" ? input.marketDataSource : null,
      market_data_updated_at: typeof input.marketDataUpdatedAt === "string" ? input.marketDataUpdatedAt : null,
      is_stale: Boolean(input.isStale),
      metadata: input as Json
    })
  });
  return rows[0];
}
