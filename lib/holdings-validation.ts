export type HoldingInput = {
  accountId: string;
  ticker: string;
  companyName?: string | null;
  shares: number;
  averageCost: number;
  targetAllocation?: number | null;
  notes?: string | null;
};

export function parseHoldingInput(body: unknown): { data?: HoldingInput; error?: string } {
  if (!body || typeof body !== "object") {
    return { error: "Request body is required." };
  }

  const input = body as Record<string, unknown>;
  const accountId = String(input.accountId ?? "").trim();
  const ticker = String(input.ticker ?? "").trim().toUpperCase();
  const companyName = normalizeOptionalString(input.companyName);
  const notes = normalizeOptionalString(input.notes);
  const shares = Number(input.shares);
  const averageCost = Number(input.averageCost);
  const targetAllocation =
    input.targetAllocation === undefined || input.targetAllocation === null || input.targetAllocation === ""
      ? null
      : Number(input.targetAllocation);

  if (!accountId) return { error: "Account is required." };
  if (!ticker) return { error: "Ticker is required." };
  if (!Number.isFinite(shares) || shares <= 0) return { error: "Shares must be greater than 0." };
  if (!Number.isFinite(averageCost) || averageCost < 0) return { error: "Average cost must be greater than or equal to 0." };
  if (targetAllocation !== null && (!Number.isFinite(targetAllocation) || targetAllocation < 0)) {
    return { error: "Target allocation must be greater than or equal to 0." };
  }

  return {
    data: {
      accountId,
      ticker,
      companyName,
      shares,
      averageCost,
      targetAllocation,
      notes
    }
  };
}

function normalizeOptionalString(value: unknown) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}
