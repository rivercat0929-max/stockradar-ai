import { defaultSettings, getSettings, updateSettings } from "@/lib/settings";
import { getUserSettings, updateUserSettings } from "@/lib/repositories/settings";
import { authErrorResponse, getCurrentUserFromRequest } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

export async function GET(request: Request) {
  const auth = await getCurrentUserFromRequest(request);
  if (!auth.ok) return authErrorResponse(auth);
  try {
    const settings = await getUserSettings(auth.user.id, defaultSettings);
    return Response.json({ success: true, data: settings, sync: { status: "synced" } });
  } catch {
    return Response.json({ success: false, data: getSettings(), error: "云端设置暂时不可用。", sync: { status: "cloud-unavailable" } }, { status: 503 });
  }
}

export async function POST(request: Request) {
  return PUT(request);
}

export async function PUT(request: Request) {
  const auth = await getCurrentUserFromRequest(request);
  if (!auth.ok) return authErrorResponse(auth);
  try {
    const body = await request.json();
    const normalized = updateSettings(body);
    const settings = await updateUserSettings(auth.user.id, normalized, defaultSettings);
    return Response.json({ success: true, data: settings, sync: { status: "synced" } });
  } catch (error) {
    console.error("PUT /api/settings failed", error instanceof Error ? error.message : String(error));
    return Response.json({ success: false, error: "设置保存失败。", sync: { status: "failed" } }, { status: 500 });
  }
}
