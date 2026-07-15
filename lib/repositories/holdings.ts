import { eq, hasSupabaseAdmin, order, supabaseAdminRequest } from "@/lib/supabase/admin";
import type { SupabaseHoldingRow } from "@/lib/types/database";
import type { Holding } from "@/lib/types";
import { finiteNonNegativeNumber, normalizeSymbol, optionalText, RepositoryError, toNumber } from "@/lib/repositories/shared";

export type HoldingInput = {
  ticker?: string;
  symbol?: string;
  companyName?: string | null;
  shares?: number;
  quantity?: number;
  averageCost?: number;
  currency?: string;
  accountName?: string | null;
  notes?: string | null;
};

export async function getHoldings(userId: string) {
  if (!hasSupabaseAdmin()) throw new RepositoryError("Supabase 未配置。");
  const rows = await supabaseAdminRequest<SupabaseHoldingRow[]>(`holdings?${eq("user_id", userId)}&${order("created_at", "desc")}`);
  return rows.map(toHolding);
}

export async function createHolding(userId: string, input: HoldingInput) {
  const rows = await supabaseAdminRequest<SupabaseHoldingRow[]>("holdings", { method: "POST", body: JSON.stringify(toHoldingRowInput(userId, input)) });
  return toHolding(rows[0]);
}

export async function updateHolding(userId: string, id: string, input: HoldingInput) {
  const rows = await supabaseAdminRequest<SupabaseHoldingRow[]>(`holdings?${eq("id", id)}&${eq("user_id", userId)}`, { method: "PATCH", body: JSON.stringify(toHoldingRowInput(userId, input)) });
  if (!rows[0]) throw new RepositoryError("持仓不存在。");
  return toHolding(rows[0]);
}

export async function deleteHolding(userId: string, id: string) {
  await supabaseAdminRequest<null>(`holdings?${eq("id", id)}&${eq("user_id", userId)}`, { method: "DELETE" });
}

export async function replaceHoldings(userId: string, holdings: HoldingInput[]) {
  const existing = await getHoldings(userId);
  await Promise.all(existing.map((item) => deleteHolding(userId, item.id)));
  const created = [];
  for (const holding of holdings) created.push(await createHolding(userId, holding));
  return created;
}

function toHoldingRowInput(userId: string, input: HoldingInput) {
  const symbol = normalizeSymbol(input.symbol ?? input.ticker);
  const quantity = finiteNonNegativeNumber(input.quantity ?? input.shares);
  const averageCost = finiteNonNegativeNumber(input.averageCost);
  if (!symbol) throw new RepositoryError("股票代码不能为空。");
  if (quantity === null) throw new RepositoryError("股数必须为有效数字。");
  if (averageCost === null) throw new RepositoryError("平均成本必须为有效数字。");
  return {
    user_id: userId,
    symbol,
    company_name: optionalText(input.companyName),
    quantity,
    average_cost: averageCost,
    currency: input.currency ?? "USD",
    account_name: optionalText(input.accountName),
    notes: optionalText(input.notes),
    updated_at: new Date().toISOString()
  };
}

function toHolding(row: SupabaseHoldingRow): Holding {
  return {
    id: row.id,
    ticker: row.symbol,
    companyName: row.company_name,
    shares: toNumber(row.quantity),
    averageCost: toNumber(row.average_cost),
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    account: row.account_name ? { id: row.account_name, name: row.account_name, currency: row.currency, createdAt: row.created_at, updatedAt: row.updated_at } : undefined
  };
}
