import { Prisma, PrismaClient } from "@prisma/client";
import { parseHoldingInput } from "@/lib/holdings-validation";

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

    return Response.json(holdings);
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
    return Response.json({ error: "Failed to create holding" }, { status: 500 });
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

    return Response.json({ error: "Failed to update holding" }, { status: 500 });
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

    return Response.json({ error: "Failed to delete holding" }, { status: 500 });
  }
}

function getHoldingId(body: unknown) {
  if (!body || typeof body !== "object") return null;
  const id = (body as Record<string, unknown>).id;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}
