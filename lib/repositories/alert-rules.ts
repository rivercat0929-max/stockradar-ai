import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { finiteNonNegativeNumber, normalizeSymbol, RepositoryError } from "@/lib/repositories/shared";

export async function getAlertRules() {
  try {
    return await prisma.alertRule.findMany({ orderBy: { createdAt: "desc" } });
  } catch (cause) {
    throw new RepositoryError("预警规则暂时不可用。", cause);
  }
}

export async function createAlertRule(input: Record<string, unknown>) {
  const symbol = normalizeSymbol(input.symbol ?? input.ticker);
  if (!symbol) throw new RepositoryError("股票代码不能为空。");
  const threshold = input.threshold ?? input.targetValue;
  const row = await prisma.alertRule.create({
    data: {
      symbol,
      ruleType: String(input.ruleType ?? input.alertType ?? "price"),
      operator: typeof input.operator === "string" ? input.operator : null,
      threshold: threshold === null || threshold === undefined ? null : finiteNonNegativeNumber(threshold),
      configuration: toJsonObject(input),
      isEnabled: typeof input.isEnabled === "boolean" ? input.isEnabled : true
    }
  });
  return row;
}

export async function updateAlertRule(id: string, input: Record<string, unknown>) {
  const threshold = input.threshold ?? input.targetValue;
  return prisma.alertRule.update({
    where: { id },
    data: {
      ...(input.symbol || input.ticker ? { symbol: normalizeSymbol(input.symbol ?? input.ticker) } : {}),
      ...(input.ruleType || input.alertType ? { ruleType: String(input.ruleType ?? input.alertType) } : {}),
      ...(input.operator !== undefined ? { operator: typeof input.operator === "string" ? input.operator : null } : {}),
      ...(threshold !== undefined ? { threshold: threshold === null ? null : finiteNonNegativeNumber(threshold) } : {}),
      ...(input.configuration !== undefined ? { configuration: toJsonObject(isRecord(input.configuration) ? input.configuration : {}) } : {}),
      ...(input.isEnabled !== undefined ? { isEnabled: Boolean(input.isEnabled) } : {})
    }
  });
}

export async function deleteAlertRule(id: string) {
  await prisma.alertRule.delete({ where: { id } });
}

function toJsonObject(input: Record<string, unknown>): Prisma.InputJsonObject {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as Prisma.InputJsonObject;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
