import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { RepositoryError } from "@/lib/repositories/shared";

const settingsId = "single-user-settings";

export async function getUserSettings(defaults: Record<string, unknown>) {
  try {
    const row = await prisma.userSettings.findUnique({ where: { id: settingsId } });
    return { ...defaults, ...(isRecord(row?.settings) ? row.settings : {}) };
  } catch (cause) {
    throw new RepositoryError("云端设置暂时不可用。", cause);
  }
}

export async function updateUserSettings(settings: Record<string, unknown>, defaults: Record<string, unknown>) {
  try {
    const merged = { ...defaults, ...settings };
    const row = await prisma.userSettings.upsert({
      where: { id: settingsId },
      update: { settings: toJsonValue(merged) },
      create: { id: settingsId, settings: toJsonValue(merged) }
    });
    return { ...defaults, ...(isRecord(row.settings) ? row.settings : merged) };
  } catch (cause) {
    throw new RepositoryError("设置保存失败。", cause);
  }
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
