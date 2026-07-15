import { cookies } from "next/headers";
import { getCurrentUserFromRequest } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const result = await getCurrentUserFromRequest(request);
  if (!result.ok) return Response.json({ authenticated: false, error: result.error }, { status: result.status });
  return Response.json({ authenticated: true, user: result.user });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const accessToken = typeof body?.access_token === "string" ? body.access_token : "";
  const refreshToken = typeof body?.refresh_token === "string" ? body.refresh_token : "";
  const expiresAt = typeof body?.expires_at === "number" ? body.expires_at : Math.floor(Date.now() / 1000) + 60 * 60;
  if (!accessToken) return Response.json({ success: false, error: "登录凭证缺失。" }, { status: 400 });

  const verifyRequest = new Request(request.url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const result = await getCurrentUserFromRequest(verifyRequest);
  if (!result.ok) return Response.json({ success: false, error: result.error }, { status: result.status });

  const maxAge = Math.max(60, expiresAt - Math.floor(Date.now() / 1000));
  cookies().set("stockradar_access_token", accessToken, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge });
  if (refreshToken) cookies().set("stockradar_refresh_token", refreshToken, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return Response.json({ success: true, user: result.user });
}

export async function DELETE() {
  cookies().delete("stockradar_access_token");
  cookies().delete("stockradar_refresh_token");
  return Response.json({ success: true });
}
