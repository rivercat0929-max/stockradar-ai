import { createWatchlistItem, deleteWatchlistItem, getWatchlist, updateWatchlistItem } from "@/lib/repositories/watchlist";
import { RepositoryError } from "@/lib/repositories/shared";
import { enrichWatchlistItems } from "@/lib/watchlist";
import { accessErrorResponse, requirePersonalAccess } from "@/lib/auth/access-key";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

export async function GET(request: Request) {
  const access = requirePersonalAccess(request);
  if (!access.ok) return accessErrorResponse(access);
  try {
    const rows = await getWatchlist();
    const items = await enrichWatchlistItems(rows);
    return Response.json({ success: true, data: items, items, error: null, sync: { status: "synced" } });
  } catch (error) {
    const safeError = sanitizeError(error);
    console.error("GET /api/watchlist failed", safeError);
    return Response.json({
      success: false,
      data: [],
      items: [],
      error: "自选股云端数据暂时不可用。",
      errorType: "database_error",
      errorCode: safeError.code ?? null,
      sync: { status: "cloud-unavailable" }
    }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const access = requirePersonalAccess(request);
  if (!access.ok) return accessErrorResponse(access);
  try {
    const item = await createWatchlistItem(await request.json());
    const [enriched] = await enrichWatchlistItems([item]);
    return Response.json({ success: true, data: enriched, item: enriched, sync: { status: "synced" } }, { status: 201 });
  } catch (error) {
    return repositoryErrorResponse(error, "自选股保存失败。");
  }
}

export async function PUT(request: Request) {
  const access = requirePersonalAccess(request);
  if (!access.ok) return accessErrorResponse(access);
  try {
    const body = await request.json();
    const id = typeof body.id === "string" ? body.id : "";
    if (!id) return Response.json({ success: false, error: "自选股 id 必填。" }, { status: 400 });
    const item = await updateWatchlistItem(id, body);
    const [enriched] = await enrichWatchlistItems([item]);
    return Response.json({ success: true, data: enriched, item: enriched, sync: { status: "synced" } });
  } catch (error) {
    return repositoryErrorResponse(error, "自选股更新失败。");
  }
}

export async function DELETE(request: Request) {
  const access = requirePersonalAccess(request);
  if (!access.ok) return accessErrorResponse(access);
  try {
    const body = await request.json();
    const id = typeof body.id === "string" ? body.id : "";
    if (!id) return Response.json({ success: false, error: "自选股 id 必填。" }, { status: 400 });
    await deleteWatchlistItem(id);
    return Response.json({ success: true, data: { id }, sync: { status: "synced" } });
  } catch (error) {
    return repositoryErrorResponse(error, "自选股删除失败。");
  }
}

function repositoryErrorResponse(error: unknown, fallback: string) {
  const message = error instanceof RepositoryError ? error.message : fallback;
  const duplicate = error instanceof Error && error.message.includes("409");
  const safeError = sanitizeError(error);
  console.error("POST/PUT/DELETE /api/watchlist failed", safeError);
  return Response.json({ success: false, error: duplicate ? "该股票已在自选股中。" : message, errorType: duplicate ? "conflict" : "database_error", errorCode: safeError.code ?? null }, { status: duplicate ? 409 : 500 });
}

function sanitizeError(error: unknown) {
  const cause = error instanceof RepositoryError ? error.cause : null;
  const code = readErrorCode(cause) ?? readErrorCode(error);
  return error instanceof Error ? { name: error.name, message: error.message, code } : { message: String(error), code };
}

function readErrorCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && typeof error.code === "string" ? error.code : null;
}
