import { prisma } from "@/lib/prisma";
import type { Holding } from "@/lib/types";
import { finiteNonNegativeNumber, normalizeSymbol, optionalText, RepositoryError } from "@/lib/repositories/shared";

export type HoldingInput = {
  ticker?: string;
  symbol?: string;
  companyName?: string | null;
  shares?: number;
  quantity?: number;
  averageCost?: number;
  currency?: string;
  accountName?: string | null;
  accountId?: string | null;
  notes?: string | null;
};

export async function getHoldings() {
  try {
    const rows = await prisma.holding.findMany({ include: { account: true }, orderBy: { createdAt: "desc" } });
    return rows.map(toHolding);
  } catch (cause) {
    throw new RepositoryError("云端数据库暂时不可用。", cause);
  }
}

export async function createHolding(input: HoldingInput) {
  try {
    const data = await toHoldingCreateInput(input);
    const row = await prisma.holding.create({ data, include: { account: true } });
    return toHolding(row);
  } catch (cause) {
    if (cause instanceof RepositoryError) throw cause;
    throw new RepositoryError("无法保存持仓数据。", cause);
  }
}

export async function updateHolding(id: string, input: HoldingInput) {
  try {
    const symbol = normalizeSymbol(input.symbol ?? input.ticker);
    const shares = finiteNonNegativeNumber(input.quantity ?? input.shares);
    const averageCost = finiteNonNegativeNumber(input.averageCost);
    const account = await getAccount(input);
    const row = await prisma.holding.update({
      where: { id },
      data: {
        ...(symbol ? { ticker: symbol } : {}),
        ...(input.companyName !== undefined ? { companyName: optionalText(input.companyName) } : {}),
        ...(shares !== null ? { shares } : {}),
        ...(averageCost !== null ? { averageCost } : {}),
        ...(input.notes !== undefined ? { notes: optionalText(input.notes) } : {}),
        ...(account ? { accountId: account.id } : {})
      },
      include: { account: true }
    });
    return toHolding(row);
  } catch (cause) {
    if (cause instanceof RepositoryError) throw cause;
    throw new RepositoryError("无法更新持仓数据。", cause);
  }
}

export async function deleteHolding(id: string) {
  try {
    await prisma.holding.delete({ where: { id } });
  } catch (cause) {
    throw new RepositoryError("无法删除持仓数据。", cause);
  }
}

export async function replaceHoldings(holdings: HoldingInput[]) {
  const created: Holding[] = [];
  for (const holding of holdings) created.push(await createHolding(holding));
  return created;
}

async function toHoldingCreateInput(input: HoldingInput) {
  const ticker = normalizeSymbol(input.symbol ?? input.ticker);
  const shares = finiteNonNegativeNumber(input.quantity ?? input.shares);
  const averageCost = finiteNonNegativeNumber(input.averageCost);
  if (!ticker) throw new RepositoryError("股票代码不能为空。");
  if (shares === null) throw new RepositoryError("股数必须为有效数字。");
  if (averageCost === null) throw new RepositoryError("平均成本必须为有效数字。");
  const account = await getAccount(input);
  return {
    ticker,
    companyName: optionalText(input.companyName),
    shares,
    averageCost,
    accountId: account.id,
    notes: optionalText(input.notes)
  };
}

async function getAccount(input: HoldingInput) {
  if (input.accountId) {
    const account = await prisma.portfolioAccount.findUnique({ where: { id: input.accountId } });
    if (account) return account;
  }
  const name = optionalText(input.accountName) ?? "默认账户";
  const existing = await prisma.portfolioAccount.findFirst({ where: { name } });
  if (existing) return existing;
  return prisma.portfolioAccount.create({
    data: { name, currency: input.currency ?? "USD" }
  });
}

function toHolding(row: Awaited<ReturnType<typeof prisma.holding.findMany>>[number] & { account?: Holding["account"] }): Holding {
  return {
    id: row.id,
    accountId: row.accountId,
    account: row.account ?? undefined,
    ticker: row.ticker,
    companyName: row.companyName,
    shares: row.shares,
    averageCost: row.averageCost,
    targetAllocation: row.targetAllocation,
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}
