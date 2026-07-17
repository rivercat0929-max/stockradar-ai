import { deleteTradePlan, getTradePlans, upsertTradePlan } from "@/lib/trade-plans";
import { accessErrorResponse, requirePersonalAccess } from "@/lib/auth/access-key";
import { RepositoryError } from "@/lib/repositories/shared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

export async function GET(request: Request) {
  const access = requirePersonalAccess(request);
  if (!access.ok) return accessErrorResponse(access);
  try {
    return Response.json({ success: true, data: await getTradePlans() });
  } catch (error) {
    return errorResponse(error, "买卖计划暂时不可用。");
  }
}

export async function POST(request: Request) {
  const access = requirePersonalAccess(request);
  if (!access.ok) return accessErrorResponse(access);
  try {
    return Response.json({ success: true, data: await upsertTradePlan(await request.json()) });
  } catch (error) {
    return errorResponse(error, "买卖计划保存失败。");
  }
}

export async function DELETE(request: Request) {
  const access = requirePersonalAccess(request);
  if (!access.ok) return accessErrorResponse(access);
  try {
    const body = await request.json();
    await deleteTradePlan(typeof body.symbol === "string" ? body.symbol : body.ticker);
    return Response.json({ success: true });
  } catch (error) {
    return errorResponse(error, "买卖计划删除失败。");
  }
}

function errorResponse(error: unknown, fallback: string) {
  const message = error instanceof RepositoryError ? error.message : fallback;
  return Response.json({ success: false, error: message }, { status: 500 });
}
