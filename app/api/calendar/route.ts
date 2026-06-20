import { buildEventCalendar } from "@/lib/calendar";
import type { Holding } from "@/lib/types";
import { toHoldingLikeWatchlistItems, type WatchlistRecord } from "@/lib/watchlist";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const holdingsResponse = await fetch(new URL("/api/holdings", request.url), { cache: "no-store" });
    const watchlistResponse = await fetch(new URL("/api/watchlist", request.url), { cache: "no-store" });
    const holdingsData = await holdingsResponse.json();
    const watchlistData = await watchlistResponse.json();
    const holdings = Array.isArray(holdingsData) ? (holdingsData as Holding[]) : [];
    const watchlistItems = Array.isArray(watchlistData.items) ? (watchlistData.items as WatchlistRecord[]) : [];
    const watchlistHoldings = toHoldingLikeWatchlistItems(watchlistItems) as Holding[];

    return Response.json(await buildEventCalendar([...holdings, ...watchlistHoldings], request.url));
  } catch (error) {
    console.error("GET /api/calendar failed", error);
    return Response.json({
      todayEvents: [],
      highRiskEvents: [],
      nextFomc: null,
      timeline: [],
      holdingEvents: [],
      dataSources: { real: [], fallback: [], mock: [] },
      errors: ["事件日历暂时不可用，请稍后再试。"]
    });
  }
}
