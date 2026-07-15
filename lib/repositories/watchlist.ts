import { eq, hasSupabaseAdmin, order, supabaseAdminRequest } from "@/lib/supabase/admin";
import { finiteNonNegativeNumber, normalizeSymbol, optionalText, RepositoryError, toNumber } from "@/lib/repositories/shared";
import type { SupabaseWatchlistRow } from "@/lib/types/database";
import type { WatchlistRecord } from "@/lib/watchlist";

export type WatchlistInput = {
  ticker?: string;
  symbol?: string;
  companyName?: string | null;
  targetBuyPrice?: number | null;
  targetSellPrice?: number | null;
  watchReason?: string | null;
  notes?: string | null;
};

export async function getWatchlist(userId: string) {
  if (!hasSupabaseAdmin()) throw new RepositoryError("Supabase 未配置。");
  const rows = await supabaseAdminRequest<SupabaseWatchlistRow[]>(`watchlist?${eq("user_id", userId)}&${order("created_at", "desc")}`);
  return rows.map(toWatchlistRecord);
}

export async function createWatchlistItem(userId: string, input: WatchlistInput) {
  const rows = await supabaseAdminRequest<SupabaseWatchlistRow[]>("watchlist", { method: "POST", body: JSON.stringify(toRowInput(userId, input)) });
  return toWatchlistRecord(rows[0]);
}

export async function updateWatchlistItem(userId: string, id: string, input: WatchlistInput) {
  const rows = await supabaseAdminRequest<SupabaseWatchlistRow[]>(`watchlist?${eq("id", id)}&${eq("user_id", userId)}`, { method: "PATCH", body: JSON.stringify(toRowInput(userId, input)) });
  if (!rows[0]) throw new RepositoryError("自选股不存在。");
  return toWatchlistRecord(rows[0]);
}

export async function deleteWatchlistItem(userId: string, id: string) {
  await supabaseAdminRequest<null>(`watchlist?${eq("id", id)}&${eq("user_id", userId)}`, { method: "DELETE" });
}

function toRowInput(userId: string, input: WatchlistInput) {
  const symbol = normalizeSymbol(input.symbol ?? input.ticker);
  if (!symbol) throw new RepositoryError("股票代码不能为空。");
  return {
    user_id: userId,
    symbol,
    company_name: optionalText(input.companyName),
    target_buy_price: input.targetBuyPrice === null ? null : finiteNonNegativeNumber(input.targetBuyPrice),
    target_sell_price: input.targetSellPrice === null ? null : finiteNonNegativeNumber(input.targetSellPrice),
    notes: optionalText(input.notes ?? input.watchReason),
    updated_at: new Date().toISOString()
  };
}

function toWatchlistRecord(row: SupabaseWatchlistRow): WatchlistRecord {
  return {
    id: row.id,
    userId: row.user_id,
    ticker: row.symbol,
    companyName: row.company_name ?? row.symbol,
    market: "US",
    status: "观察",
    group: "重点观察",
    targetBuyPrice: row.target_buy_price === null ? null : toNumber(row.target_buy_price),
    targetSellPrice: row.target_sell_price === null ? null : toNumber(row.target_sell_price),
    watchReason: null,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
