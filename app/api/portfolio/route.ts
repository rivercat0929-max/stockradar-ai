import { analyzePortfolio } from "@/lib/portfolio";
import type { Holding } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const holdingsUrl = new URL("/api/holdings", request.url);
    const response = await fetch(holdingsUrl, { cache: "no-store", headers: { cookie: request.headers.get("cookie") ?? "" } });
    const payload = await response.json();
    const holdings = Array.isArray(payload?.data) ? payload.data : payload;

    if (!response.ok || !Array.isArray(holdings)) {
      return Response.json({ error: "无法读取当前持仓。" }, { status: 502 });
    }

    return Response.json(analyzePortfolio(holdings as Holding[]));
  } catch (error) {
    console.error("GET /api/portfolio failed", error);
    return Response.json({ error: "组合分析暂时不可用，请稍后再试。" }, { status: 500 });
  }
}
