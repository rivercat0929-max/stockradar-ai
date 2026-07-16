import { deleteHolding, updateHolding } from "@/lib/repositories/holdings";
import { RepositoryError } from "@/lib/repositories/shared";
import { accessErrorResponse, requirePersonalAccess } from "@/lib/auth/access-key";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const access = requirePersonalAccess(request);
  if (!access.ok) return accessErrorResponse(access);
  try {
    const data = await updateHolding(params.id, await request.json());
    return Response.json({ success: true, data });
  } catch (error) {
    return Response.json({ success: false, error: error instanceof RepositoryError ? error.message : "无法更新持仓数据" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const access = requirePersonalAccess(request);
  if (!access.ok) return accessErrorResponse(access);
  try {
    await deleteHolding(params.id);
    return Response.json({ success: true, data: { id: params.id } });
  } catch {
    return Response.json({ success: false, error: "无法删除持仓数据" }, { status: 500 });
  }
}
