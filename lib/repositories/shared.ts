export class RepositoryError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
  }
}

export function normalizeSymbol(value: unknown) {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

export function finiteNonNegativeNumber(value: unknown) {
  const numberValue = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : null;
}

export function toNumber(value: number | string | null | undefined) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function optionalText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
