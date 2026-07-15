import { getMarketEvents, type EventType } from "@/lib/events";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const from = url.searchParams.get("from") ?? undefined;
  const to = url.searchParams.get("to") ?? undefined;
  const symbols = splitParam(url.searchParams.get("symbols"));
  const types = splitParam(url.searchParams.get("types")) as EventType[];

  try {
    const result = await getMarketEvents({
      from,
      to,
      symbols,
      types: types.length ? types : undefined
    });

    const sources = Array.from(new Set(result.events.map((event) => event.source)));
    const updatedAt = result.events.map((event) => event.updatedAt).filter(Boolean).sort().at(-1) ?? null;

    return Response.json({
      success: true,
      data: result.events,
      warnings: result.warnings.length ? result.warnings : undefined,
      meta: {
        from: from ?? null,
        to: to ?? null,
        count: result.events.length,
        sources,
        updatedAt
      }
    });
  } catch (error) {
    console.error("GET /api/events failed", error);
    return Response.json({
      success: true,
      data: [],
      warnings: ["事件数据暂时不可用"],
      meta: {
        from: from ?? null,
        to: to ?? null,
        count: 0,
        sources: [],
        updatedAt: null
      }
    });
  }
}

function splitParam(value: string | null) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
