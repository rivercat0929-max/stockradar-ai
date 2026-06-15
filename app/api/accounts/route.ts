import { Prisma, PrismaClient } from "@prisma/client";

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

export async function GET() {
  try {
    if (!process.env.DATABASE_URL) {
      return Response.json([]);
    }

    const prisma = getPrisma();
    const existingAccounts = await prisma.portfolioAccount.findMany({
      orderBy: { createdAt: "asc" }
    });

    if (existingAccounts.length > 0) {
      return Response.json(existingAccounts);
    }

    const defaultAccount = await prisma.portfolioAccount.create({
      data: {
        name: "Default Account",
        currency: "USD"
      }
    });

    return Response.json([defaultAccount]);
  } catch (error) {
    console.error("GET /api/accounts failed", error);

    if (error instanceof Prisma.PrismaClientInitializationError) {
      return Response.json({ error: "Database connection failed. Check DATABASE_URL in Vercel." }, { status: 503 });
    }

    return Response.json([]);
  }
}
