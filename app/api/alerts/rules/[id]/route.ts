import { accessErrorResponse, requirePersonalAccess } from "@/lib/auth/access-key";
import { deleteAlertRule, updateAlertRule } from "@/lib/repositories/alert-rules";
import { RepositoryError } from "@/lib/repositories/shared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const access = requirePersonalAccess(request);
  if (!access.ok) return accessErrorResponse(access);
  try {
    const data = await updateAlertRule(params.id, await request.json());
    return Response.json({ success: true, data, sync: { status: "synced" } });
  } catch (error) {
    return Response.json({ success: false, error: error instanceof RepositoryError ? error.message : "预警规则更新失败。" }, { status: 400 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const access = requirePersonalAccess(request);
  if (!access.ok) return accessErrorResponse(access);
  try {
    await deleteAlertRule(params.id);
    return Response.json({ success: true, data: { id: params.id }, sync: { status: "synced" } });
  } catch {
    return Response.json({ success: false, error: "预警规则删除失败。" }, { status: 500 });
  }
}
