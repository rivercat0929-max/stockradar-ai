import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseHoldingInput } from "@/lib/holdings-validation";

export const dynamic = "force-dynamic";

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
