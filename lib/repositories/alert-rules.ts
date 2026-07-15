import { eq, hasSupabaseAdmin, order, supabaseAdminRequest } from "@/lib/supabase/admin";
import { normalizeSymbol, RepositoryError } from "@/lib/repositories/shared";
import type { Json, SupabaseAlertRuleRow } from "@/lib/types/database";

export async function getAlertRules(userId: string) {
  if (!hasSupabaseAdmin()) throw new RepositoryError("Supabase 未配置。");
  return supabaseAdminRequest<SupabaseAlertRuleRow[]>(`alert_rules?${eq("user_id", userId)}&${order("created_at", "desc")}`);
}

export async function createAlertRule(userId: string, input: Record<string, unknown>) {
  const symbol = normalizeSymbol(input.symbol ?? input.ticker);
  if (!symbol) throw new RepositoryError("股票代码不能为空。");
  const rows = await supabaseAdminRequest<SupabaseAlertRuleRow[]>("alert_rules", {
    method: "POST",
    body: JSON.stringify({
      user_id: userId,
      symbol,
      rule_type: String(input.ruleType ?? input.alertType ?? "price"),
      operator: typeof input.operator === "string" ? input.operator : null,
      threshold: typeof input.threshold === "number" ? input.threshold : typeof input.targetValue === "number" ? input.targetValue : null,
      configuration: input as Json,
      is_enabled: true
    })
  });
  return rows[0];
}
