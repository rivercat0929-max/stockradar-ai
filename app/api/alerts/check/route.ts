import { getAiScore, toAiScoreSummary } from "@/lib/ai-score";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tickers = Array.from(
    new Set(
      (searchParams.get("tickers") ?? "")
        .split(",")
        .map((ticker) => ticker.trim().toUpperCase())
        .filter(Boolean)
    )
  );

  if (!tickers.length) {
    return Response.json({ results: [], errors: [{ ticker: null, error: "At least one ticker is required." }] }, { status: 400 });
  }

  const settled = await Promise.allSettled(tickers.map((ticker) => getAiScore(ticker)));

  return Response.json({
    results: settled.flatMap((item) => (item.status === "fulfilled" ? [toAiScoreSummary(item.value)] : [])),
    errors: settled.flatMap((item, index) =>
      item.status === "rejected"
        ? [
            {
              ticker: tickers[index],
              error: item.reason instanceof Error ? item.reason.message : "评分暂不可用，请稍后重试"
            }
          ]
        : []
    )
  });
}
