import { prisma } from "@/lib/prisma";
import { finiteNonNegativeNumber, normalizeSymbol, optionalText, RepositoryError } from "@/lib/repositories/shared";

export type TradePlan = {
  symbol: string;
  buyZoneLow: number | null;
  buyZoneHigh: number | null;
  addPrice1: number | null;
  addPrice2: number | null;
  riskControlPrice: number | null;
  targetPrice1: number | null;
  targetPrice2: number | null;
  maxPositionWeight: number | null;
  thesis: string | null;
  invalidationConditions: string[];
  notes: string | null;
  updatedAt: string;
};

export type TradePlanInput = Partial<Omit<TradePlan, "symbol" | "updatedAt">> & {
  symbol?: string;
  ticker?: string;
};

const settingsId = "trade-plans-v1";

export async function getTradePlans(): Promise<TradePlan[]> {
  try {
    const row = await prisma.userSettings.findUnique({ where: { id: settingsId } });
    return parsePlans(row?.settings);
  } catch (cause) {
    throw new RepositoryError("买卖计划暂时不可用。", cause);
  }
}

export async function getTradePlan(symbol: string): Promise<TradePlan | null> {
  const normalized = normalizeSymbol(symbol);
  if (!normalized) return null;
  return (await getTradePlans()).find((plan) => plan.symbol === normalized) ?? null;
}

export async function upsertTradePlan(input: TradePlanInput): Promise<TradePlan> {
  try {
    const symbol = normalizeSymbol(input.symbol ?? input.ticker);
    if (!symbol) throw new RepositoryError("股票代码不能为空。");
    const plans = await getTradePlans();
    const existing = plans.find((plan) => plan.symbol === symbol);
    const nextPlan: TradePlan = {
      symbol,
      buyZoneLow: normalizePrice(input.buyZoneLow, existing?.buyZoneLow),
      buyZoneHigh: normalizePrice(input.buyZoneHigh, existing?.buyZoneHigh),
      addPrice1: normalizePrice(input.addPrice1, existing?.addPrice1),
      addPrice2: normalizePrice(input.addPrice2, existing?.addPrice2),
      riskControlPrice: normalizePrice(input.riskControlPrice, existing?.riskControlPrice),
      targetPrice1: normalizePrice(input.targetPrice1, existing?.targetPrice1),
      targetPrice2: normalizePrice(input.targetPrice2, existing?.targetPrice2),
      maxPositionWeight: normalizePrice(input.maxPositionWeight, existing?.maxPositionWeight),
      thesis: input.thesis !== undefined ? optionalText(input.thesis) : existing?.thesis ?? null,
      invalidationConditions: normalizeConditions(input.invalidationConditions ?? existing?.invalidationConditions ?? []),
      notes: input.notes !== undefined ? optionalText(input.notes) : existing?.notes ?? null,
      updatedAt: new Date().toISOString()
    };
    const nextPlans = [nextPlan, ...plans.filter((plan) => plan.symbol !== symbol)].sort((a, b) => a.symbol.localeCompare(b.symbol));
    await savePlans(nextPlans);
    return nextPlan;
  } catch (cause) {
    if (cause instanceof RepositoryError) throw cause;
    throw new RepositoryError("买卖计划保存失败。", cause);
  }
}

export async function deleteTradePlan(symbol: string) {
  try {
    const normalized = normalizeSymbol(symbol);
    if (!normalized) throw new RepositoryError("股票代码不能为空。");
    await savePlans((await getTradePlans()).filter((plan) => plan.symbol !== normalized));
  } catch (cause) {
    if (cause instanceof RepositoryError) throw cause;
    throw new RepositoryError("买卖计划删除失败。", cause);
  }
}

function normalizePrice(value: unknown, fallback: number | null = null) {
  if (value === undefined) return fallback;
  if (value === null || value === "") return null;
  return finiteNonNegativeNumber(value);
}

function normalizeConditions(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => optionalText(item)).filter((item): item is string => Boolean(item));
  if (typeof value === "string") return value.split(/\r?\n|;/).map((item) => optionalText(item)).filter((item): item is string => Boolean(item));
  return [];
}

function parsePlans(value: unknown): TradePlan[] {
  const record = value && typeof value === "object" ? value as { plans?: unknown } : null;
  if (!Array.isArray(record?.plans)) return [];
  return record.plans.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const symbol = normalizeSymbol(row.symbol);
    if (!symbol) return [];
    return [{
      symbol,
      buyZoneLow: numberOrNull(row.buyZoneLow),
      buyZoneHigh: numberOrNull(row.buyZoneHigh),
      addPrice1: numberOrNull(row.addPrice1),
      addPrice2: numberOrNull(row.addPrice2),
      riskControlPrice: numberOrNull(row.riskControlPrice),
      targetPrice1: numberOrNull(row.targetPrice1),
      targetPrice2: numberOrNull(row.targetPrice2),
      maxPositionWeight: numberOrNull(row.maxPositionWeight),
      thesis: optionalText(row.thesis),
      invalidationConditions: normalizeConditions(row.invalidationConditions),
      notes: optionalText(row.notes),
      updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : new Date(0).toISOString()
    }];
  });
}

async function savePlans(plans: TradePlan[]) {
  await prisma.userSettings.upsert({
    where: { id: settingsId },
    update: { settings: { plans } },
    create: { id: settingsId, settings: { plans } }
  });
}

function numberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
