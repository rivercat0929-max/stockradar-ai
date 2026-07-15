import { generateRadarAlertsV2 } from "@/lib/alerts-v2";
import type { Holding } from "@/lib/types";
import { toHoldingLikeWatchlistItems, type WatchlistRecord } from "@/lib/watchlist";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const headers = { cookie: request.headers.get("cookie") ?? "" };
    const { searchParams } = new URL(request.url);
    const tickers = (searchParams.get("tickers") ?? "")
      .split(",")
      .map((ticker) => ticker.trim().toUpperCase())
      .filter(Boolean);
    const holdingsResponse = await fetch(new URL("/api/holdings", request.url), { cache: "no-store", headers });
    const watchlistResponse = await fetch(new URL("/api/watchlist", request.url), { cache: "no-store", headers });
    const holdingsData = await holdingsResponse.json();
    const watchlistData = await watchlistResponse.json();
    const holdings = Array.isArray(holdingsData?.data) ? (holdingsData.data as Holding[]) : Array.isArray(holdingsData) ? (holdingsData as Holding[]) : [];
    const watchlistItems = Array.isArray(watchlistData?.data) ? (watchlistData.data as WatchlistRecord[]) : Array.isArray(watchlistData.items) ? (watchlistData.items as WatchlistRecord[]) : [];
    const watchlistHoldings = toHoldingLikeWatchlistItems(watchlistItems) as Holding[];

    return Response.json(await generateRadarAlertsV2({ tickers, holdings: [...holdings, ...watchlistHoldings] }));
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
