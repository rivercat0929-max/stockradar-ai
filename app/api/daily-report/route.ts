import { generateRadarAlertsV2 } from "@/lib/alerts-v2";
import { buildEventCalendar } from "@/lib/calendar";
import { buildDailyReport, buildEmptyDailyReport } from "@/lib/daily-report";
import type { Holding } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const holdings = await loadHoldings(request.url);
    const alerts = await generateRadarAlertsV2({ tickers: [], holdings });
    const calendar = await buildEventCalendar(holdings, request.url);

    return Response.json(buildDailyReport({ holdings, alerts, calendar }));
  } catch (error) {
    console.error("GET /api/daily-report failed", error);
    return Response.json(
      buildEmptyDailyReport("每日报告暂时无法读取完整数据，已生成空白预览结构。")
    );
  }
}

async function loadHoldings(requestUrl: string) {
  try {
    const response = await fetch(new URL("/api/holdings", requestUrl), { cache: "no-store" });
    const data = await response.json();
    return Array.isArray(data) ? (data as Holding[]) : [];
  } catch {
    return [];
  }
}
