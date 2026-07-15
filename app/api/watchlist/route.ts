import { createWatchlistItem, deleteWatchlistItem, getWatchlist, updateWatchlistItem } from "@/lib/repositories/watchlist";
import { RepositoryError } from "@/lib/repositories/shared";
import { enrichWatchlistItems } from "@/lib/watchlist";
import { authErrorResponse, getCurrentUserFromRequest } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

export async function GET(request: Request) {
  const auth = await getCurrentUserFromRequest(request);
  if (!auth.ok) return authErrorResponse(auth);
  try {
    const items = await enrichWatchlistItems(await getWatchlist(auth.user.id));
    return Response.json({ success: true, data: items, items, error: null, sync: { status: "synced" } });
  } catch (error) {
    console.error("GET /api/watchlist failed", sanitizeError(error));
    return Response.json({ success: false, data: [], items: [], error: "自选股暂时不可用。", sync: { status: "cloud-unavailable" } }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const auth = await getCurrentUserFromRequest(request);
  if (!auth.ok) return authErrorResponse(auth);
  try {
    const item = await createWatchlistItem(auth.user.id, await request.json());
    const [enriched] = await enrichWatchlistItems([item]);
    return Response.json({ success: true, data: enriched, item: enriched, sync: { status: "synced" } }, { status: 201 });
  } catch (error) {
    return repositoryErrorResponse(error, "自选股保存失败。");
  }
}

export async function PUT(request: Request) {
  const auth = await getCurrentUserFromRequest(request);
  if (!auth.ok) return authErrorResponse(auth);
  try {
    const body = await request.json();
    const id = typeof body.id === "string" ? body.id : "";
    if (!id) return Response.json({ success: false, error: "自选股 id 必填。" }, { status: 400 });
    const item = await updateWatchlistItem(auth.user.id, id, body);
    const [enriched] = await enrichWatchlistItems([item]);
    return Response.json({ success: true, data: enriched, item: enriched, sync: { status: "synced" } });
  } catch (error) {
    return repositoryErrorResponse(error, "自选股更新失败。");
  }
}

export async function DELETE(request: Request) {
  const auth = await getCurrentUserFromRequest(request);
  if (!auth.ok) return authErrorResponse(auth);
  try {
    const body = await request.json();
    const id = typeof body.id === "string" ? body.id : "";
    if (!id) return Response.json({ success: false, error: "自选股 id 必填。" }, { status: 400 });
    await deleteWatchlistItem(auth.user.id, id);
    return Response.json({ success: true, data: { id }, sync: { status: "synced" } });
  } catch (error) {
    return repositoryErrorResponse(error, "自选股删除失败。");
  }
}

function repositoryErrorResponse(error: unknown, fallback: string) {
  const message = error instanceof RepositoryError ? error.message : fallback;
  const duplicate = error instanceof Error && error.message.includes("409");
  return Response.json({ success: false, error: duplicate ? "该股票已在自选股中。" : message }, { status: duplicate ? 409 : 500 });
}

function sanitizeError(error: unknown) {
  return error instanceof Error ? { name: error.name, message: error.message } : { message: String(error) };
}
