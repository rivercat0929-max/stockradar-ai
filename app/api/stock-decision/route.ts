import { getStockDecision } from "@/lib/stock-decision";
import { accessErrorResponse, requirePersonalAccess } from "@/lib/auth/access-key";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

export async function GET(request: Request) {
  const access = requirePersonalAccess(request);
  if (!access.ok) return accessErrorResponse(access);
  const symbol = new URL(request.url).searchParams.get("symbol")?.trim().toUpperCase();
  if (!symbol) return Response.json({ success: false, error: "股票代码必填。" }, { status: 400 });
  try {
    return Response.json({ success: true, data: await getStockDecision(symbol) });
  } catch (error) {
    return Response.json({ success: false, error: error instanceof Error ? error.message : "决策暂不可用。" }, { status: 502 });
  }
}
