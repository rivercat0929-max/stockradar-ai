import { getMarketEvents } from "@/lib/events";
import type { Holding } from "@/lib/types";
import { toHoldingLikeWatchlistItems, type WatchlistRecord } from "@/lib/watchlist";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const headers = { cookie: request.headers.get("cookie") ?? "" };
    const [holdingsResponse, watchlistResponse] = await Promise.all([
      fetch(new URL("/api/holdings", request.url), { cache: "no-store", headers }),
      fetch(new URL("/api/watchlist", request.url), { cache: "no-store", headers })
    ]);
    const holdingsData = await holdingsResponse.json().catch(() => []);
    const watchlistData = await watchlistResponse.json().catch(() => ({ items: [] }));
    const holdings = Array.isArray(holdingsData?.data) ? (holdingsData.data as Holding[]) : Array.isArray(holdingsData) ? (holdingsData as Holding[]) : [];
    const watchlistItems = Array.isArray(watchlistData?.data) ? (watchlistData.data as WatchlistRecord[]) : Array.isArray(watchlistData.items) ? (watchlistData.items as WatchlistRecord[]) : [];
    const watchlistHoldings = toHoldingLikeWatchlistItems(watchlistItems) as Holding[];
    const symbols = Array.from(new Set([...holdings, ...watchlistHoldings].map((item) => item.ticker.trim().toUpperCase()).filter(Boolean)));
    const from = new URL(request.url).searchParams.get("from") ?? undefined;
    const to = new URL(request.url).searchParams.get("to") ?? undefined;
    const result = await getMarketEvents({ from, to, symbols });

    return Response.json({
      success: true,
      data: result.events,
      warnings: result.warnings,
      meta: {
        count: result.events.length,
        sources: Array.from(new Set(result.events.map((event) => event.source))),
        updatedAt: result.events.map((event) => event.updatedAt).filter(Boolean).sort().at(-1) ?? null
      }
    });
  } catch (error) {
    console.error("GET /api/calendar failed", error);
    return Response.json({
      success: true,
      data: [],
      warnings: ["事件日历暂时不可用"],
      meta: { count: 0, sources: [], updatedAt: null }
    });
  }
}
