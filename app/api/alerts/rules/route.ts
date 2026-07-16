import { accessErrorResponse, requirePersonalAccess } from "@/lib/auth/access-key";
import { createAlertRule, getAlertRules } from "@/lib/repositories/alert-rules";
import { RepositoryError } from "@/lib/repositories/shared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const access = requirePersonalAccess(request);
  if (!access.ok) return accessErrorResponse(access);
  try {
    return Response.json({ success: true, data: await getAlertRules(), sync: { status: "synced" } });
  } catch (error) {
    return Response.json({ success: false, data: [], error: error instanceof RepositoryError ? error.message : "预警规则暂时不可用。" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const access = requirePersonalAccess(request);
  if (!access.ok) return accessErrorResponse(access);
  try {
    const data = await createAlertRule(await request.json());
    return Response.json({ success: true, data, sync: { status: "synced" } }, { status: 201 });
  } catch (error) {
    return Response.json({ success: false, error: error instanceof RepositoryError ? error.message : "预警规则保存失败。" }, { status: 400 });
  }
}
