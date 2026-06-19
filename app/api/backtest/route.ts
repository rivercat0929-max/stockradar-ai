import { runBacktest, type BacktestInput, type BuyRule, type SellRule } from "@/lib/backtest";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = parseBacktestInput(body);
    return Response.json(await runBacktest(input));
  } catch (error) {
    console.error("POST /api/backtest failed", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "历史数据暂不可用" },
      { status: 400 }
    );
  }
}

function parseBacktestInput(body: unknown): BacktestInput {
  const data = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};

  return {
    ticker: typeof data.ticker === "string" ? data.ticker.trim().toUpperCase() : "",
    startDate: typeof data.startDate === "string" ? data.startDate : "",
    endDate: typeof data.endDate === "string" ? data.endDate : "",
    initialCapital: typeof data.initialCapital === "number" ? data.initialCapital : Number(data.initialCapital),
    buyRules: Array.isArray(data.buyRules) ? data.buyRules.filter(isBuyRule) : [],
    sellRules: Array.isArray(data.sellRules) ? data.sellRules.filter(isSellRule) : []
  };
}

function isBuyRule(value: unknown): value is BuyRule {
  return value === "ai_score_gt_80" || value === "break_above_ma20" || value === "break_above_ma50" || value === "rsi_below_30";
}

function isSellRule(value: unknown): value is SellRule {
  return value === "break_below_ma20" || value === "break_below_ma50" || value === "stop_loss_10" || value === "take_profit_30";
}
