import { getStockDecisions } from "@/lib/stock-decision";
import { accessErrorResponse, requirePersonalAccess } from "@/lib/auth/access-key";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

export async function GET(request: Request) {
  const access = requirePersonalAccess(request);
  if (!access.ok) return accessErrorResponse(access);
  const symbols = (new URL(request.url).searchParams.get("symbols") ?? "").split(",").map((item) => item.trim().toUpperCase()).filter(Boolean);
  if (!symbols.length) return Response.json({ success: true, data: [], errors: [] });
  const result = await getStockDecisions(symbols);
  return Response.json({ success: true, data: result.results, errors: result.errors });
}
