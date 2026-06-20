import { getDataHealth } from "@/lib/data-health";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

export async function GET() {
  try {
    return Response.json(await getDataHealth());
  } catch (error) {
    console.error("GET /api/data-health failed", error);
    return Response.json({
      checkedAt: new Date().toISOString(),
      providers: [],
      apiKey: {
        exists: Boolean(process.env.FMP_API_KEY),
        prefix: process.env.FMP_API_KEY ? process.env.FMP_API_KEY.slice(0, 4) : null,
        usable: false,
        rateLimited: false,
        statusCode: null,
        message: "系统诊断暂时不可用。"
      },
      cache: {
        totalEntries: 0,
        activeEntries: 0,
        staleEntries: 0,
        lastUpdatedAt: null,
        label: "缓存数据"
      },
      currentFallback: true,
      failureCount: 0
    });
  }
}
