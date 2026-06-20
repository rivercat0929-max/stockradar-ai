import { Prisma, PrismaClient } from "@prisma/client";
import {
  defaultWatchlistUser,
  enrichWatchlistItems,
  normalizeWatchlistInput,
  parseWatchlistInput,
  type WatchlistRecord
} from "@/lib/watchlist";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

let prismaClient: PrismaClient | null = null;

function getPrisma() {
  if (!prismaClient) prismaClient = new PrismaClient();
  return prismaClient;
}

export async function GET() {
  try {
    if (!process.env.DATABASE_URL) return Response.json({ items: [], error: null });

    const user = await getDefaultUser();
    const items = await getPrisma().watchlist.findMany({
      where: { userId: user.id },
      orderBy: [{ group: "asc" }, { createdAt: "desc" }]
    });

    return Response.json({ items: await enrichWatchlistItems(items as WatchlistRecord[]), error: null });
  } catch (error) {
    console.error("GET /api/watchlist failed", error);
    return Response.json({ items: [], error: "自选股暂时不可用，已返回空列表。" });
  }
}

export async function POST(request: Request) {
  try {
    if (!process.env.DATABASE_URL) return databaseNotConfigured();

    const body = await request.json();
    const parsed = parseWatchlistInput(body);
    if (!parsed.data) return Response.json({ error: parsed.error }, { status: 400 });

    const user = await getDefaultUser();
    const data = await normalizeWatchlistInput(parsed.data);
    const item = await getPrisma().watchlist.upsert({
      where: {
        userId_ticker: {
          userId: user.id,
          ticker: data.ticker
        }
      },
      create: {
        userId: user.id,
        ticker: data.ticker,
        companyName: data.companyName,
        market: data.market,
        status: "观察",
        group: data.group,
        targetBuyPrice: data.targetBuyPrice,
        targetSellPrice: data.targetSellPrice,
        watchReason: data.watchReason,
        notes: data.notes
      },
      update: {
        companyName: data.companyName,
        market: data.market,
        group: data.group,
        targetBuyPrice: data.targetBuyPrice,
        targetSellPrice: data.targetSellPrice,
        watchReason: data.watchReason,
        notes: data.notes
      }
    });

    const [enriched] = await enrichWatchlistItems([item as WatchlistRecord]);
    return Response.json(enriched, { status: 201 });
  } catch (error) {
    console.error("POST /api/watchlist failed", error);
    return prismaErrorResponse(error, "自选股保存失败。");
  }
}

export async function PUT(request: Request) {
  try {
    if (!process.env.DATABASE_URL) return databaseNotConfigured();

    const body = await request.json();
    const id = getId(body);
    if (!id) return Response.json({ error: "自选股 id 必填。" }, { status: 400 });

    const parsed = parseWatchlistInput(body);
    if (!parsed.data) return Response.json({ error: parsed.error }, { status: 400 });

    const data = await normalizeWatchlistInput(parsed.data);
    const item = await getPrisma().watchlist.update({
      where: { id },
      data: {
        ticker: data.ticker,
        companyName: data.companyName,
        market: data.market,
        group: data.group,
        targetBuyPrice: data.targetBuyPrice,
        targetSellPrice: data.targetSellPrice,
        watchReason: data.watchReason,
        notes: data.notes
      }
    });

    const [enriched] = await enrichWatchlistItems([item as WatchlistRecord]);
    return Response.json(enriched);
  } catch (error) {
    console.error("PUT /api/watchlist failed", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return Response.json({ error: "自选股不存在。" }, { status: 404 });
    }

    return prismaErrorResponse(error, "自选股更新失败。");
  }
}

export async function DELETE(request: Request) {
  try {
    if (!process.env.DATABASE_URL) return databaseNotConfigured();

    const body = await request.json();
    const id = getId(body);
    if (!id) return Response.json({ error: "自选股 id 必填。" }, { status: 400 });

    await getPrisma().watchlist.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/watchlist failed", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return Response.json({ error: "自选股不存在。" }, { status: 404 });
    }

    return prismaErrorResponse(error, "自选股删除失败。");
  }
}

async function getDefaultUser() {
  return getPrisma().user.upsert({
    where: { email: defaultWatchlistUser.email },
    create: defaultWatchlistUser,
    update: { name: defaultWatchlistUser.name }
  });
}

function getId(body: unknown) {
  if (!body || typeof body !== "object") return null;
  const id = (body as Record<string, unknown>).id;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

function databaseNotConfigured() {
  return Response.json({ error: "数据库未配置，无法持久化自选股。" }, { status: 503 });
}

function prismaErrorResponse(error: unknown, fallback: string) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2021" || error.code === "P2022") {
      return Response.json({ error: "Watchlist 数据表未更新，请先运行 Prisma migration。" }, { status: 500 });
    }

    if (error.code === "P2002") {
      return Response.json({ error: "该股票已在自选股中。" }, { status: 409 });
    }
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return Response.json({ error: "数据库连接失败，请检查 DATABASE_URL。" }, { status: 503 });
  }

  return Response.json({ error: fallback }, { status: 500 });
}
