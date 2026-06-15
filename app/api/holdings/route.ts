import { Prisma, PrismaClient } from "@prisma/client";
import { parseHoldingInput } from "@/lib/holdings-validation";
import { getQuote } from "@/lib/market-data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

let prismaClient: PrismaClient | null = null;

function getPrisma() {
  if (!prismaClient) {
    prismaClient = new PrismaClient();
  }

  return prismaClient;
}

function databaseNotConfigured() {
  return Response.json({ error: "Database is not configured" }, { status: 503 });
}

export async function GET() {
  try {
    if (!process.env.DATABASE_URL) {
      return Response.json([]);
    }

    const holdings = await getPrisma().holding.findMany({
      orderBy: { createdAt: "desc" }
    });

    const enrichedHoldings = await enrichHoldingsWithMarketData(holdings);

    return Response.json(enrichedHoldings);
  } catch (error) {
    console.error("GET /api/holdings failed", error);
    return Response.json([]);
  }
}

export async function POST(request: Request) {
  try {
    if (!process.env.DATABASE_URL) {
      return databaseNotConfigured();
    }

    const body = await request.json();
    const result = parseHoldingInput(body);

    if (!result.data) {
      return Response.json({ error: result.error }, { status: 400 });
    }

    const holding = await getPrisma().holding.create({
      data: result.data
    });

    return Response.json(holding, { status: 201 });
  } catch (error) {
    console.error("POST /api/holdings failed", error);
    return prismaErrorResponse(error, "Failed to create holding");
  }
}

export async function PUT(request: Request) {
  try {
    if (!process.env.DATABASE_URL) {
      return databaseNotConfigured();
    }

    const body = await request.json();
    const id = getHoldingId(body);
    if (!id) {
      return Response.json({ error: "Holding id is required." }, { status: 400 });
    }

    const result = parseHoldingInput(body);
    if (!result.data) {
      return Response.json({ error: result.error }, { status: 400 });
    }

    const holding = await getPrisma().holding.update({
      where: { id },
      data: result.data
    });

    return Response.json(holding);
  } catch (error) {
    console.error("PUT /api/holdings failed", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return Response.json({ error: "Holding not found." }, { status: 404 });
    }

    return prismaErrorResponse(error, "Failed to update holding");
  }
}

export async function DELETE(request: Request) {
  try {
    if (!process.env.DATABASE_URL) {
      return databaseNotConfigured();
    }

    const body = await request.json();
    const id = getHoldingId(body);
    if (!id) {
      return Response.json({ error: "Holding id is required." }, { status: 400 });
    }

    await getPrisma().holding.delete({
      where: { id }
    });

    return Response.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/holdings failed", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return Response.json({ error: "Holding not found." }, { status: 404 });
    }

    return prismaErrorResponse(error, "Failed to delete holding");
  }
}

function getHoldingId(body: unknown) {
  if (!body || typeof body !== "object") return null;
  const id = (body as Record<string, unknown>).id;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

async function enrichHoldingsWithMarketData<T extends { ticker: string; shares: number; averageCost: number }>(holdings: T[]) {
  const quotedHoldings = await Promise.all(
    holdings.map(async (holding) => {
      const quote = await getQuote(holding.ticker);
      const currentPrice = quote.price;
      const marketValue = roundMoney(holding.shares * currentPrice);
      const totalCost = roundMoney(holding.shares * holding.averageCost);
      const unrealizedPL = roundMoney(marketValue - totalCost);
      const unrealizedPLPercent = totalCost > 0 ? roundPercent((unrealizedPL / totalCost) * 100) : 0;

      return {
        ...holding,
        companyName: holdingHasCompanyName(holding) ? holding.companyName ?? quote.name : quote.name,
        quote,
        currentPrice,
        marketValue,
        totalCost,
        unrealizedPL,
        unrealizedPLPercent,
        marketDataSource: quote.marketDataSource
      };
    })
  );

  const totalMarketValue = quotedHoldings.reduce((sum, holding) => sum + holding.marketValue, 0);

  return quotedHoldings.map((holding) => ({
    ...holding,
    allocation: totalMarketValue > 0 ? roundPercent((holding.marketValue / totalMarketValue) * 100) : 0
  }));
}

function holdingHasCompanyName(holding: unknown): holding is { companyName?: string | null } {
  return typeof holding === "object" && holding !== null && "companyName" in holding;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function roundPercent(value: number) {
  return Math.round(value * 100) / 100;
}

function prismaErrorResponse(error: unknown, fallback: string) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2021") {
      return Response.json({ error: "Database table is missing. Run Prisma migrations for the Neon database." }, { status: 500 });
    }

    if (error.code === "P2002") {
      return Response.json({ error: "A record with the same unique value already exists." }, { status: 409 });
    }
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return Response.json({ error: "Database connection failed. Check DATABASE_URL in Vercel." }, { status: 503 });
  }

  return Response.json({ error: fallback }, { status: 500 });
}
