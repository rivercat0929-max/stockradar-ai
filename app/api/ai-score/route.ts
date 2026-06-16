import { getAiScore, getCachedAiScore } from "@/lib/ai-score";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get("ticker")?.trim().toUpperCase();
  const apiKey = process.env.FMP_API_KEY;

  if (!ticker) {
    return Response.json({ error: "Ticker is required." }, { status: 400 });
  }

  if (!apiKey) {
    const cachedScore = getCachedAiScore(ticker);
    if (cachedScore) return Response.json(cachedScore);

    return Response.json({ error: "FMP_API_KEY is not configured. Add it to your local environment and try again." }, { status: 500 });
  }

  try {
    return Response.json(await getAiScore(ticker, apiKey));
  } catch (error) {
    return Response.json({ error: getFriendlyError(error) }, { status: 502 });
  }
}

function getFriendlyError(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Unable to fetch FMP quote data. Please try again later.";
}
