import { createHolding, deleteHolding, getHoldings, updateHolding } from "@/lib/repositories/holdings";
import { RepositoryError } from "@/lib/repositories/shared";
import { authErrorResponse, getCurrentUserFromRequest } from "@/lib/supabase/server";
import { getQuote } from "@/lib/market-data";
import type { Holding } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

export async function GET(request: Request) {
  const auth = await getCurrentUserFromRequest(request);
  if (!auth.ok) return authErrorResponse(auth);
  try {
    return Response.json({ success: true, data: await enrichHoldingsWithMarketData(await getHoldings(auth.user.id)), sync: { status: "synced" } });
  } catch (error) {
    console.error("GET /api/holdings failed", sanitizeError(error));
    return Response.json({ success: false, data: [], error: "无法读取持仓数据", sync: { status: "cloud-unavailable" } }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const auth = await getCurrentUserFromRequest(request);
  if (!auth.ok) return authErrorResponse(auth);
  try {
    const body = await request.json();
    const holding = await createHolding(auth.user.id, normalizeInput(body));
    const [enriched] = await enrichHoldingsWithMarketData([holding]);
    return Response.json({ success: true, data: enriched, sync: { status: "synced" } }, { status: 201 });
  } catch (error) {
    return repositoryErrorResponse(error, "无法保存持仓数据");
  }
}

export async function PUT(request: Request) {
  const auth = await getCurrentUserFromRequest(request);
  if (!auth.ok) return authErrorResponse(auth);
  try {
    const body = await request.json();
    const id = getId(body);
    if (!id) return Response.json({ success: false, error: "Holding id is required." }, { status: 400 });
    const holding = await updateHolding(auth.user.id, id, normalizeInput(body));
    const [enriched] = await enrichHoldingsWithMarketData([holding]);
    return Response.json({ success: true, data: enriched, sync: { status: "synced" } });
  } catch (error) {
    return repositoryErrorResponse(error, "无法更新持仓数据");
  }
}

export async function DELETE(request: Request) {
  const auth = await getCurrentUserFromRequest(request);
  if (!auth.ok) return authErrorResponse(auth);
  try {
    const body = await request.json();
    const id = getId(body);
    if (!id) return Response.json({ success: false, error: "Holding id is required." }, { status: 400 });
    await deleteHolding(auth.user.id, id);
    return Response.json({ success: true, data: { id }, sync: { status: "synced" } });
  } catch (error) {
    return repositoryErrorResponse(error, "无法删除持仓数据");
  }
}

function normalizeInput(body: Record<string, unknown>) {
  return {
    ticker: typeof body.ticker === "string" ? body.ticker : typeof body.symbol === "string" ? body.symbol : "",
    companyName: typeof body.companyName === "string" ? body.companyName : null,
    shares: typeof body.shares === "number" ? body.shares : typeof body.quantity === "number" ? body.quantity : Number(body.shares ?? body.quantity),
    averageCost: typeof body.averageCost === "number" ? body.averageCost : Number(body.averageCost),
    accountName: typeof body.accountName === "string" ? body.accountName : null,
    notes: typeof body.notes === "string" ? body.notes : null
  };
}

function getId(body: unknown) {
  if (!body || typeof body !== "object") return null;
  const id = (body as Record<string, unknown>).id;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

async function enrichHoldingsWithMarketData(holdings: Holding[]) {
  const quotedHoldings = await Promise.all(holdings.map(async (holding) => {
    const quote = await getQuote(holding.ticker);
    const currentPrice = quote.price;
    const hasPrice = typeof currentPrice === "number" && Number.isFinite(currentPrice);
    const marketValue = hasPrice ? roundMoney(holding.shares * currentPrice) : null;
    const totalCost = roundMoney(holding.shares * holding.averageCost);
    const unrealizedPL = marketValue === null ? null : roundMoney(marketValue - totalCost);
    const unrealizedPLPercent = unrealizedPL !== null && totalCost > 0 ? roundPercent((unrealizedPL / totalCost) * 100) : null;
    return { ...holding, companyName: holding.companyName ?? quote.name, quote, currentPrice, marketValue, totalCost, unrealizedPL, unrealizedPLPercent, marketDataSource: quote.marketDataSource };
  }));
  const totalMarketValue = quotedHoldings.reduce((sum, holding) => sum + (holding.marketValue ?? 0), 0);
  return quotedHoldings.map((holding) => ({ ...holding, allocation: totalMarketValue > 0 && holding.marketValue !== null ? roundPercent((holding.marketValue / totalMarketValue) * 100) : 0 }));
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function roundPercent(value: number) {
  return Math.round(value * 100) / 100;
}

function repositoryErrorResponse(error: unknown, fallback: string) {
  const message = error instanceof RepositoryError ? error.message : fallback;
  return Response.json({ success: false, error: message }, { status: message.includes("不能为空") || message.includes("有效数字") ? 400 : 500 });
}

function sanitizeError(error: unknown) {
  return error instanceof Error ? { name: error.name, message: error.message } : { message: String(error) };
}
