import { runStockScreener, type ScreenerFilters, type ScreenerPreset } from "@/lib/screener";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filters: ScreenerFilters = {
      minMarketCap: getNumber(searchParams, "minMarketCap"),
      maxMarketCap: getNumber(searchParams, "maxMarketCap"),
      minPe: getNumber(searchParams, "minPe"),
      maxPe: getNumber(searchParams, "maxPe"),
      minEps: getNumber(searchParams, "minEps"),
      maxEps: getNumber(searchParams, "maxEps"),
      minRevenueGrowth: getNumber(searchParams, "minRevenueGrowth"),
      minGrossMargin: getNumber(searchParams, "minGrossMargin"),
      minNetMargin: getNumber(searchParams, "minNetMargin"),
      minRoe: getNumber(searchParams, "minRoe"),
      industry: getText(searchParams, "industry"),
      minAiScore: getNumber(searchParams, "minAiScore"),
      minVolume: getNumber(searchParams, "minVolume"),
      preset: getPreset(searchParams.get("preset"))
    };

    return Response.json(await runStockScreener(filters));
  } catch (error) {
    console.error("GET /api/screener failed", error);
    return Response.json({
      stockPool: [],
      poolNotice: "V1 当前基于精选股票池筛选，后续将扩展至全市场。",
      results: [],
      errors: [{ ticker: "ALL", error: "选股器暂时不可用，请稍后重试。" }],
      dataNotice: "部分数据为缓存/估算结果。",
      dataSources: { real: 0, cached: 0, estimated: 0, mock: 0 }
    });
  }
}

function getNumber(searchParams: URLSearchParams, key: string) {
  const raw = searchParams.get(key);
  if (raw === null || raw.trim() === "") return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

function getText(searchParams: URLSearchParams, key: string) {
  const value = searchParams.get(key)?.trim();
  return value ? value : undefined;
}

function getPreset(value: string | null): ScreenerPreset | undefined {
  if (
    value === "growth" ||
    value === "value" ||
    value === "ai_strength" ||
    value === "quality" ||
    value === "oversold" ||
    value === "large_cap"
  ) {
    return value;
  }
  return undefined;
}
