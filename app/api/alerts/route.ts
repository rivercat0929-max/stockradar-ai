import { generateRadarAlertsV2 } from "@/lib/alerts-v2";
import type { Holding } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tickers = (searchParams.get("tickers") ?? "")
      .split(",")
      .map((ticker) => ticker.trim().toUpperCase())
      .filter(Boolean);
    const holdingsResponse = await fetch(new URL("/api/holdings", request.url), { cache: "no-store" });
    const holdingsData = await holdingsResponse.json();
    const holdings = Array.isArray(holdingsData) ? (holdingsData as Holding[]) : [];

    return Response.json(await generateRadarAlertsV2({ tickers, holdings }));
  } catch (error) {
    console.error("GET /api/alerts failed", error);
    return Response.json({
      todayHighlights: [],
      holdingAlerts: [],
      history: [],
      errors: [{ ticker: "ALL", error: "高级预警暂时不可用，请稍后再试。" }],
      dataSources: { real: [], fallback: [], mock: [] }
    });
  }
}
