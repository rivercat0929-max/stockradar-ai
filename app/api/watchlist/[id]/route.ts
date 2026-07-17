import { deleteWatchlistItem } from "@/lib/repositories/watchlist";
import { accessErrorResponse, requirePersonalAccess } from "@/lib/auth/access-key";
import { RepositoryError } from "@/lib/repositories/shared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const access = requirePersonalAccess(request);
  if (!access.ok) return accessErrorResponse(access);
  try {
    await deleteWatchlistItem(params.id);
    return Response.json({ success: true, data: { id: params.id } });
  } catch (error) {
    const code = readErrorCode(error instanceof RepositoryError ? error.cause : error);
    console.error("DELETE /api/watchlist/[id] failed", { message: error instanceof Error ? error.message : String(error), code });
    return Response.json({ success: false, error: "无法删除自选股。", errorType: "database_error", errorCode: code }, { status: 500 });
  }
}

function readErrorCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && typeof error.code === "string" ? error.code : null;
}
