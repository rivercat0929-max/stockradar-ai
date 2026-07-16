import { defaultSettings, getSettings, updateSettings } from "@/lib/settings";
import { getUserSettings, updateUserSettings } from "@/lib/repositories/settings";
import { accessErrorResponse, requirePersonalAccess } from "@/lib/auth/access-key";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

export async function GET(request: Request) {
  const access = requirePersonalAccess(request);
  if (!access.ok) return accessErrorResponse(access);
  try {
    const settings = await getUserSettings(defaultSettings);
    return Response.json({ success: true, data: settings, sync: { status: "synced" } });
  } catch {
    return Response.json({ success: false, data: getSettings(), error: "云端设置暂时不可用。", sync: { status: "cloud-unavailable" } }, { status: 503 });
  }
}

export async function POST(request: Request) {
  return PUT(request);
}

export async function PUT(request: Request) {
  const access = requirePersonalAccess(request);
  if (!access.ok) return accessErrorResponse(access);
  try {
    const body = await request.json();
    const normalized = updateSettings(body);
    const settings = await updateUserSettings(normalized, defaultSettings);
    return Response.json({ success: true, data: settings, sync: { status: "synced" } });
  } catch (error) {
    console.error("PUT /api/settings failed", error instanceof Error ? error.message : String(error));
    return Response.json({ success: false, error: "设置保存失败。", sync: { status: "failed" } }, { status: 500 });
  }
}
