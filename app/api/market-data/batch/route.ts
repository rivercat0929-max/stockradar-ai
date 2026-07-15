import { getMarketQuotes } from "@/lib/market-data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const inputSymbols: unknown[] = Array.isArray(body.symbols) ? body.symbols : [];
    const symbols = Array.from(new Set(inputSymbols.map((symbol) => (typeof symbol === "string" ? symbol.trim().toUpperCase() : "")).filter(Boolean))).slice(0, 50);
    const data = await getMarketQuotes(symbols);
    return Response.json({
      success: data.every((quote) => quote.source !== "unavailable"),
      data,
      errors: data.filter((quote) => quote.source === "unavailable").map((quote) => ({ symbol: quote.symbol, error: quote.error }))
    });
  } catch {
    return Response.json({ success: false, data: [], error: "Market data batch request failed." }, { status: 200 });
  }
}

