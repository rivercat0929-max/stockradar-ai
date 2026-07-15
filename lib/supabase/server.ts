import "server-only";
import { cookies } from "next/headers";
import { getOwnerEmail, getSupabasePublicConfig, isSupabaseConfigured } from "@/lib/supabase/config";

export type AuthUser = {
  id: string;
  email: string;
};

export type AuthResult =
  | { ok: true; user: AuthUser; accessToken: string }
  | { ok: false; status: number; error: string };

export async function getCurrentUserFromRequest(request?: Request): Promise<AuthResult> {
  if (!isSupabaseConfigured()) return { ok: false, status: 503, error: "Supabase 尚未配置。" };
  const accessToken = getAccessToken(request);
  if (!accessToken) return { ok: false, status: 401, error: "请先登录。" };

  const config = getSupabasePublicConfig();
  const response = await fetch(`${config.url}/auth/v1/user`, {
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${accessToken}`
    },
    cache: "no-store"
  });

  if (!response.ok) return { ok: false, status: 401, error: "登录状态已过期，请重新登录。" };
  const data = await response.json().catch(() => null);
  const id = typeof data?.id === "string" ? data.id : "";
  const email = typeof data?.email === "string" ? data.email.toLowerCase() : "";
  if (!id || !email) return { ok: false, status: 401, error: "登录状态无效。" };
  const ownerEmail = getOwnerEmail();
  if (ownerEmail && email !== ownerEmail) return { ok: false, status: 403, error: "无权访问。本系统目前仅授权指定账户使用。" };
  return { ok: true, user: { id, email }, accessToken };
}

export function authErrorResponse(result: Exclude<AuthResult, { ok: true }>) {
  return Response.json({ success: false, error: result.error }, { status: result.status });
}

function getAccessToken(request?: Request) {
  const authHeader = request?.headers.get("authorization");
  if (authHeader?.toLowerCase().startsWith("bearer ")) return authHeader.slice(7).trim();
  const requestCookie = request?.headers.get("cookie") ?? "";
  const fromRequest = requestCookie.match(/(?:^|;\s*)stockradar_access_token=([^;]+)/)?.[1];
  if (fromRequest) return decodeURIComponent(fromRequest);
  return cookies().get("stockradar_access_token")?.value ?? "";
}
