import { buildEventCalendar } from "@/lib/calendar";
import type { Holding } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const holdingsResponse = await fetch(new URL("/api/holdings", request.url), { cache: "no-store" });
    const holdingsData = await holdingsResponse.json();
    const holdings = Array.isArray(holdingsData) ? (holdingsData as Holding[]) : [];

    return Response.json(await buildEventCalendar(holdings, request.url));
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
