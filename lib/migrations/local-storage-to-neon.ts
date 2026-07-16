"use client";

export type LocalStorageMigrationStatus = "not_started" | "completed" | "skipped" | "failed";
export const migrationStatusKey = "stockradar_neon_migration_v1";

export function getLocalStorageMigrationSummary() {
  if (typeof window === "undefined") {
    return { holdingsCount: 0, watchlistCount: 0, alertsCount: 0, settingsFound: false, status: "not_started" as LocalStorageMigrationStatus };
  }
  return {
    holdingsCount: readArray(["stockradar_holdings", "stockradar-holdings", "holdings"]).length,
    watchlistCount: readArray(["stockradar_watchlist", "stockradar-watchlist", "watchlist"]).length,
    alertsCount: readArray(["stockradar_alerts", "stockradar-alerts", "alerts"]).length,
    settingsFound: readObject(["stockradar_settings", "stockradar-settings", "settings"]) !== null,
    status: getMigrationStatus()
  };
}

export function getMigrationStatus(): LocalStorageMigrationStatus {
  if (typeof window === "undefined") return "not_started";
  const value = window.localStorage.getItem(migrationStatusKey);
  return value === "completed" || value === "skipped" || value === "failed" ? value : "not_started";
}

export function markMigrationSkipped() {
  if (typeof window !== "undefined") window.localStorage.setItem(migrationStatusKey, "skipped");
}

export async function migrateLocalStorageToNeon() {
  const holdings = readArray(["stockradar_holdings", "stockradar-holdings", "holdings"]);
  const watchlist = readArray(["stockradar_watchlist", "stockradar-watchlist", "watchlist"]);
  const settings = readObject(["stockradar_settings", "stockradar-settings", "settings"]);
  const result = { imported: 0, failed: 0, skipped: 0 };

  try {
    const holdingsResponse = await fetch("/api/holdings", { cache: "no-store" });
    const holdingsPayload = await holdingsResponse.json().catch(() => null);
    const cloudHoldings = Array.isArray(holdingsPayload?.data) ? holdingsPayload.data : Array.isArray(holdingsPayload) ? holdingsPayload : [];
    if (cloudHoldings.length === 0) {
      for (const holding of holdings) {
        const response = await fetch("/api/holdings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(holding) });
        response.ok ? result.imported++ : result.failed++;
      }
    } else {
      result.skipped += holdings.length;
    }

    for (const item of watchlist) {
      const response = await fetch("/api/watchlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(item) });
      response.ok ? result.imported++ : result.failed++;
    }

    if (settings) {
      const response = await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) });
      response.ok ? result.imported++ : result.failed++;
    }

    window.localStorage.setItem(migrationStatusKey, result.failed ? "failed" : "completed");
    return result;
  } catch {
    window.localStorage.setItem(migrationStatusKey, "failed");
    return { ...result, failed: result.failed + 1 };
  }
}

function readArray(keys: string[]) {
  for (const key of keys) {
    const value = safeParse(window.localStorage.getItem(key));
    if (Array.isArray(value)) return value;
  }
  return [];
}

function readObject(keys: string[]) {
  for (const key of keys) {
    const value = safeParse(window.localStorage.getItem(key));
    if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  }
  return null;
}

function safeParse(value: string | null) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
