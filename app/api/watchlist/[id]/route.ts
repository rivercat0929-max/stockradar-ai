import { deleteWatchlistItem } from "@/lib/repositories/watchlist";
import { accessErrorResponse, requirePersonalAccess } from "@/lib/auth/access-key";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const access = requirePersonalAccess(request);
  if (!access.ok) return accessErrorResponse(access);
  try {
    await deleteWatchlistItem(params.id);
    return Response.json({ success: true, data: { id: params.id } });
  } catch {
    return Response.json({ success: false, error: "无法删除自选股。" }, { status: 500 });
  }
}
