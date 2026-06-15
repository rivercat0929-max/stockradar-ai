import { lookupStock } from "@/lib/market-data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get("symbol")?.trim().toUpperCase();

    if (!symbol) {
      return Response.json({ error: "Symbol is required." }, { status: 400 });
    }

    const stock = await lookupStock(symbol);
    return Response.json(stock);
  } catch (error) {
    console.error("GET /api/stocks/lookup failed", error);
    return Response.json({ error: "Failed to lookup stock." }, { status: 500 });
  }
}
