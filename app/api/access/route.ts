import { clearAccessCookie, isAccessKeyConfigured, requirePersonalAccess, setAccessCookie, verifyAccessKey } from "@/lib/auth/access-key";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const access = requirePersonalAccess(request);
  return Response.json({
    success: access.ok,
    unlocked: access.ok,
    configured: isAccessKeyConfigured(),
    error: access.ok ? null : access.message
  }, { status: access.ok ? 200 : access.status });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  if (!isAccessKeyConfigured()) {
    return Response.json({ success: false, error: "访问密码尚未配置。" }, { status: 503 });
  }
  if (!verifyAccessKey(body.accessKey)) {
    return Response.json({ success: false, error: "访问密码不正确。" }, { status: 401 });
  }
  setAccessCookie();
  return Response.json({ success: true, unlocked: true });
}

export async function DELETE() {
  clearAccessCookie();
  return Response.json({ success: true, unlocked: false });
}
