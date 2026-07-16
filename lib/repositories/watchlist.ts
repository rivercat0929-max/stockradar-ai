import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { defaultWatchlistUser, watchlistGroups, type WatchlistGroup, type WatchlistRecord } from "@/lib/watchlist";
import { finiteNonNegativeNumber, normalizeSymbol, optionalText, RepositoryError } from "@/lib/repositories/shared";

export type WatchlistInput = {
  ticker?: string;
  symbol?: string;
  companyName?: string | null;
  market?: string | null;
  status?: string | null;
  group?: string | null;
  targetBuyPrice?: number | null;
  targetSellPrice?: number | null;
  watchReason?: string | null;
  notes?: string | null;
};

export async function getWatchlist() {
  try {
    const user = await getSingleUser();
    const rows = await prisma.watchlist.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });
    return rows.map(toWatchlistRecord);
  } catch (cause) {
    throw new RepositoryError("云端数据库暂时不可用。", cause);
  }
}

export async function createWatchlistItem(input: WatchlistInput) {
  try {
    const user = await getSingleUser();
    const row = await prisma.watchlist.create({ data: toWatchlistCreateInput(user.id, input) });
    return toWatchlistRecord(row);
  } catch (cause) {
    if (cause instanceof RepositoryError) throw cause;
    throw new RepositoryError(isUniqueError(cause) ? "该股票已在自选股中。" : "自选股保存失败。", cause);
  }
}

export async function updateWatchlistItem(id: string, input: WatchlistInput) {
  try {
    const row = await prisma.watchlist.update({ where: { id }, data: toWatchlistUpdateInput(input) });
    return toWatchlistRecord(row);
  } catch (cause) {
    if (cause instanceof RepositoryError) throw cause;
    throw new RepositoryError("自选股更新失败。", cause);
  }
}

export async function deleteWatchlistItem(id: string) {
  try {
    await prisma.watchlist.delete({ where: { id } });
  } catch (cause) {
    throw new RepositoryError("自选股删除失败。", cause);
  }
}

async function getSingleUser() {
  return prisma.user.upsert({
    where: { email: defaultWatchlistUser.email },
    update: {},
    create: defaultWatchlistUser
  });
}

function toWatchlistCreateInput(userId: string, input: WatchlistInput) {
  const ticker = normalizeSymbol(input.symbol ?? input.ticker);
  if (!ticker) throw new RepositoryError("股票代码不能为空。");
  return {
    userId,
    ticker,
    companyName: optionalText(input.companyName) ?? ticker,
    market: optionalText(input.market) ?? "US",
    status: optionalText(input.status) ?? "观察",
    group: parseGroup(input.group),
    targetBuyPrice: input.targetBuyPrice === null ? null : finiteNonNegativeNumber(input.targetBuyPrice),
    targetSellPrice: input.targetSellPrice === null ? null : finiteNonNegativeNumber(input.targetSellPrice),
    watchReason: optionalText(input.watchReason),
    notes: optionalText(input.notes)
  };
}

function toWatchlistUpdateInput(input: WatchlistInput): Prisma.WatchlistUpdateInput {
  const data: Prisma.WatchlistUpdateInput = {};
  const companyName = optionalText(input.companyName);
  if (companyName) data.companyName = companyName;
  if (input.market !== undefined) data.market = optionalText(input.market) ?? "US";
  if (input.status !== undefined) data.status = optionalText(input.status) ?? "观察";
  if (input.group !== undefined) data.group = parseGroup(input.group);
  if (input.targetBuyPrice !== undefined) data.targetBuyPrice = input.targetBuyPrice === null ? null : finiteNonNegativeNumber(input.targetBuyPrice);
  if (input.targetSellPrice !== undefined) data.targetSellPrice = input.targetSellPrice === null ? null : finiteNonNegativeNumber(input.targetSellPrice);
  if (input.watchReason !== undefined) data.watchReason = optionalText(input.watchReason);
  if (input.notes !== undefined) data.notes = optionalText(input.notes);
  return data;
}

function parseGroup(value: unknown): WatchlistGroup {
  return typeof value === "string" && (watchlistGroups as readonly string[]).includes(value) ? value as WatchlistGroup : "重点观察";
}

function toWatchlistRecord(row: {
  id: string;
  userId: string;
  ticker: string;
  companyName: string;
  market: string;
  status: string;
  group: string;
  targetBuyPrice: number | null;
  targetSellPrice: number | null;
  watchReason: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}): WatchlistRecord {
  return {
    id: row.id,
    userId: row.userId,
    ticker: row.ticker,
    companyName: row.companyName,
    market: row.market,
    status: row.status,
    group: parseGroup(row.group),
    targetBuyPrice: row.targetBuyPrice,
    targetSellPrice: row.targetSellPrice,
    watchReason: row.watchReason,
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function isUniqueError(cause: unknown) {
  return typeof cause === "object" && cause !== null && "code" in cause && cause.code === "P2002";
}
