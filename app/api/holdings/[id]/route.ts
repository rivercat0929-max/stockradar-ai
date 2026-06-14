import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseHoldingInput } from "@/lib/holdings-validation";

export const dynamic = "force-dynamic";

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const result = parseHoldingInput(await request.json().catch(() => null));

  if (!result.data) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  try {
    const holding = await prisma.holding.update({
      where: { id: params.id },
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

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  void request;

  try {
    await prisma.holding.delete({
      where: { id: params.id }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Holding not found." }, { status: 404 });
    }

    throw error;
  }
}
