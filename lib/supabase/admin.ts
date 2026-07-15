import "server-only";
import { getSupabaseServiceConfig, isSupabaseAdminConfigured } from "@/lib/supabase/config";

type QueryValue = string | number | boolean | null | undefined;

export class SupabaseAdminError extends Error {
  constructor(message: string, public status: number | null = null) {
    super(message);
  }
}

export function hasSupabaseAdmin() {
  return isSupabaseAdminConfigured();
}

export async function supabaseAdminRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const config = getSupabaseServiceConfig();
  if (!config.url || !config.serviceRoleKey) throw new SupabaseAdminError("Supabase admin is not configured.", 503);

  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers ?? {})
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new SupabaseAdminError(`Supabase request failed with ${response.status}`, response.status);
  }

  if (response.status === 204) return null as T;
  return (await response.json().catch(() => null)) as T;
}

export function eq(column: string, value: QueryValue) {
  return `${encodeURIComponent(column)}=eq.${encodeURIComponent(String(value ?? ""))}`;
}

export function order(column: string, direction: "asc" | "desc" = "asc") {
  return `order=${encodeURIComponent(column)}.${direction}`;
}
