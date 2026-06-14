import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseHoldingInput } from "@/lib/holdings-validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const holdings = await prisma.holding.findMany({
    orderBy: { createdAt: "desc" }
  });

  return NextResponse.json(holdings);
}

export async function POST(request: Request) {
  const result = parseHoldingInput(await request.json().catch(() => null));

  if (!result.data) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const holding = await prisma.holding.create({
    data: result.data
  });

  return NextResponse.json(holding, { status: 201 });
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null);
  const id = getHoldingId(body);
  if (!id) {
    return NextResponse.json({ error: "Holding id is required." }, { status: 400 });
  }

  const result = parseHoldingInput(body);
  if (!result.data) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  try {
    const holding = await prisma.holding.update({
      where: { id },
      data: result.data
    });

    return NextResponse.json(holding);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Holding not found." }, { status: 404 });
    }

    throw error;
  }
}

export async function DELETE(request: Request) {
  const body = await request.json().catch(() => null);
  const id = getHoldingId(body);
  if (!id) {
    return NextResponse.json({ error: "Holding id is required." }, { status: 400 });
  }

  try {
    await prisma.holding.delete({
      where: { id }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Holding not found." }, { status: 404 });
    }

    throw error;
  }
}

function getHoldingId(body: unknown) {
  if (!body || typeof body !== "object") return null;
  const id = (body as Record<string, unknown>).id;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}
