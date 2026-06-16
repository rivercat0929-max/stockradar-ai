import { getAiScore, getCachedAiScore, toAiScoreSummary } from "@/lib/ai-score";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const apiKey = process.env.FMP_API_KEY;
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

  if (!apiKey) {
    const cachedResults = tickers.flatMap((ticker) => {
      const cachedScore = getCachedAiScore(ticker);
      return cachedScore ? [toAiScoreSummary(cachedScore)] : [];
    });
    const cachedTickers = new Set(cachedResults.map((result) => result.ticker.toUpperCase()));

    return Response.json({
      results: cachedResults,
      errors: tickers.filter((ticker) => !cachedTickers.has(ticker)).map((ticker) => ({
        ticker,
        error: "FMP_API_KEY is not configured. Add it to your local environment and try again."
      }))
    });
  }

  const settled = await Promise.allSettled(tickers.map((ticker) => getAiScore(ticker, apiKey)));

  return Response.json({
    results: settled.flatMap((item) => (item.status === "fulfilled" ? [toAiScoreSummary(item.value)] : [])),
    errors: settled.flatMap((item, index) =>
      item.status === "rejected"
        ? [
            {
              ticker: tickers[index],
              error: item.reason instanceof Error ? item.reason.message : "Unable to score this ticker."
            }
          ]
        : []
    )
  });
}
