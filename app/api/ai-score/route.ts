import { getAiScore, getCachedAiScore } from "@/lib/ai-score";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get("ticker")?.trim().toUpperCase();

  if (!ticker) {
    return Response.json({ error: "请输入股票代码。" }, { status: 400 });
  }

  try {
    return Response.json(await getAiScore(ticker));
  } catch (error) {
    const cachedScore = getCachedAiScore(ticker);
    if (cachedScore) return Response.json(cachedScore);
    return Response.json({ error: getFriendlyError(error) }, { status: 502 });
  }
}

function getFriendlyError(error: unknown) {
  if (error instanceof Error) return error.message;
  return "评分暂不可用，请稍后重试";
}
