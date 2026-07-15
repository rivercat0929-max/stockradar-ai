import { getMarketQuote } from "@/lib/market-data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol") ?? "";
  const data = await getMarketQuote(symbol);
  const success = data.source !== "unavailable";
  return Response.json({
    success,
    data,
    ...(success ? {} : { error: data.error ?? "Market data is temporarily unavailable." })
  });
}
