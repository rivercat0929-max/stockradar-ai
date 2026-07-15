import { deleteWatchlistItem } from "@/lib/repositories/watchlist";
import { authErrorResponse, getCurrentUserFromRequest } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const auth = await getCurrentUserFromRequest(request);
  if (!auth.ok) return authErrorResponse(auth);
  try {
    await deleteWatchlistItem(auth.user.id, params.id);
    return Response.json({ success: true, data: { id: params.id } });
  } catch {
    return Response.json({ success: false, error: "无法删除自选股。" }, { status: 500 });
  }
}
