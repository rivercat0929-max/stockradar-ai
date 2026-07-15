import { eq, hasSupabaseAdmin, supabaseAdminRequest } from "@/lib/supabase/admin";
import { RepositoryError } from "@/lib/repositories/shared";
import type { Json, SupabaseUserSettingsRow } from "@/lib/types/database";

export async function getUserSettings(userId: string, defaults: Record<string, unknown>) {
  if (!hasSupabaseAdmin()) throw new RepositoryError("Supabase 未配置。");
  const rows = await supabaseAdminRequest<SupabaseUserSettingsRow[]>(`user_settings?${eq("user_id", userId)}&limit=1`);
  return { ...defaults, ...(isRecord(rows[0]?.settings) ? rows[0].settings : {}) };
}

export async function updateUserSettings(userId: string, settings: Record<string, unknown>, defaults: Record<string, unknown>) {
  const merged = { ...defaults, ...settings };
  const rows = await supabaseAdminRequest<SupabaseUserSettingsRow[]>("user_settings?on_conflict=user_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({ user_id: userId, settings: merged as Json, updated_at: new Date().toISOString() })
  });
  return { ...defaults, ...(isRecord(rows[0]?.settings) ? rows[0].settings : merged) };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
