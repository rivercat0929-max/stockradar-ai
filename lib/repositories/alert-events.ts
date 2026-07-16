import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { finiteNonNegativeNumber, normalizeSymbol, RepositoryError } from "@/lib/repositories/shared";

export async function getAlertEvents() {
  try {
    return await prisma.alertEvent.findMany({ orderBy: { triggeredAt: "desc" } });
  } catch (cause) {
    throw new RepositoryError("预警历史暂时不可用。", cause);
  }
}

export async function createAlertEvent(input: Record<string, unknown>) {
  const symbol = normalizeSymbol(input.symbol ?? input.ticker);
  if (!symbol) throw new RepositoryError("股票代码不能为空。");
  return prisma.alertEvent.create({
    data: {
      alertRuleId: typeof input.alertRuleId === "string" ? input.alertRuleId : null,
      symbol,
      eventType: String(input.eventType ?? "alert"),
      message: String(input.message ?? "预警触发"),
      marketPrice: input.marketPrice === null || input.marketPrice === undefined ? null : finiteNonNegativeNumber(input.marketPrice),
      marketDataSource: typeof input.marketDataSource === "string" ? input.marketDataSource : null,
      marketDataUpdatedAt: typeof input.marketDataUpdatedAt === "string" ? new Date(input.marketDataUpdatedAt) : null,
      isStale: Boolean(input.isStale),
      metadata: toJsonObject(input)
    }
  });
}

function toJsonObject(input: Record<string, unknown>): Prisma.InputJsonObject {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as Prisma.InputJsonObject;
}
