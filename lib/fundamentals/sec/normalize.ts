import type { FundamentalPeriod, NormalizedFundamentals, SecCompanyFactsResponse, SecFactUnit } from "@/lib/fundamentals/sec/types";

const conceptPriority = {
  revenue: ["RevenueFromContractWithCustomerExcludingAssessedTax", "Revenues", "SalesRevenueNet"],
  netIncome: ["NetIncomeLoss"],
  epsDiluted: ["EarningsPerShareDiluted", "EarningsPerShareBasic"],
  operatingCashFlow: ["NetCashProvidedByUsedInOperatingActivities"],
  capitalExpenditure: ["PaymentsToAcquirePropertyPlantAndEquipment"],
  grossProfit: ["GrossProfit"],
  operatingIncome: ["OperatingIncomeLoss"],
  assets: ["Assets"],
  liabilities: ["Liabilities"],
  equity: ["StockholdersEquity"],
  cash: ["CashAndCashEquivalentsAtCarryingValue"],
  sharesOutstanding: ["EntityCommonStockSharesOutstanding"]
} as const;

type FieldKey = keyof typeof conceptPriority;

export function normalizeCompanyFacts(input: {
  symbol: string;
  cik: string | null;
  companyName: string | null;
  response: SecCompanyFactsResponse | null;
  status: NormalizedFundamentals["status"];
  updatedAt: string | null;
  warnings?: string[];
}): NormalizedFundamentals {
  const facts = input.response?.facts?.["us-gaap"];
  if (!facts) {
    return { symbol: input.symbol, cik: input.cik, companyName: input.companyName, status: "unavailable", source: "SEC Company Facts", updatedAt: input.updatedAt, annual: [], quarterly: [], warnings: [...(input.warnings ?? []), "SEC财务数据不足"] };
  }

  const unitsByField = Object.fromEntries(
    Object.keys(conceptPriority).map((field) => [field, selectUnits(facts, field as FieldKey)])
  ) as Record<FieldKey, { concept: string | null; units: SecFactUnit[] }>;

  const annualKeys = collectPeriodKeys(unitsByField, (unit) => unit.form === "10-K" && unit.fp === "FY");
  const quarterKeys = collectPeriodKeys(unitsByField, (unit) => unit.form === "10-Q" && /^Q[1-3]$/.test(unit.fp ?? ""));
  const annual = annualKeys.map((key) => buildPeriod(key, unitsByField, "annual")).filter(Boolean) as FundamentalPeriod[];
  const quarterly = quarterKeys.map((key) => buildPeriod(key, unitsByField, "quarterly")).filter(Boolean) as FundamentalPeriod[];

  return {
    symbol: input.symbol,
    cik: input.cik,
    companyName: input.response?.entityName ?? input.companyName,
    status: input.status,
    source: "SEC Company Facts",
    updatedAt: input.updatedAt,
    annual: annual.sort((a, b) => b.periodEnd.localeCompare(a.periodEnd)).slice(0, 6),
    quarterly: quarterly.sort((a, b) => b.periodEnd.localeCompare(a.periodEnd)).slice(0, 12),
    warnings: input.warnings ?? []
  };
}

function selectUnits(facts: NonNullable<SecCompanyFactsResponse["facts"]>["us-gaap"], field: FieldKey) {
  for (const concept of conceptPriority[field]) {
    const units = facts?.[concept]?.units;
    const preferredUnit = field === "epsDiluted" ? "USD/shares" : field === "sharesOutstanding" ? "shares" : "USD";
    const values = units?.[preferredUnit] ?? [];
    if (values.length) return { concept, units: values.filter(isCoreForm) };
  }
  return { concept: null, units: [] };
}

function collectPeriodKeys(unitsByField: Record<FieldKey, { units: SecFactUnit[] }>, predicate: (unit: SecFactUnit) => boolean) {
  const keys = new Map<string, SecFactUnit>();
  Object.values(unitsByField).forEach(({ units }) => {
    units.filter(predicate).forEach((unit) => {
      if (!unit.end) return;
      const key = `${unit.form}:${unit.fy ?? "FY"}:${unit.fp ?? ""}:${unit.end}`;
      const existing = keys.get(key);
      if (!existing || (unit.filed ?? "") > (existing.filed ?? "")) keys.set(key, unit);
    });
  });
  return Array.from(keys.values()).sort((a, b) => (b.end ?? "").localeCompare(a.end ?? ""));
}

function buildPeriod(anchor: SecFactUnit, unitsByField: Record<FieldKey, { concept: string | null; units: SecFactUnit[] }>, kind: "annual" | "quarterly") {
  if (!anchor.end || !anchor.form) return null;
  const conceptsUsed: Record<string, string | null> = {};
  const values = Object.fromEntries(Object.keys(conceptPriority).map((field) => {
    const key = field as FieldKey;
    const selected = findMatchingUnit(unitsByField[key].units, anchor, kind);
    conceptsUsed[field] = selected ? unitsByField[key].concept : null;
    return [field, selected?.val ?? null];
  })) as Record<FieldKey, number | null>;

  const capex = values.capitalExpenditure === null ? null : Math.abs(values.capitalExpenditure);
  const freeCashFlow = values.operatingCashFlow === null || capex === null ? null : values.operatingCashFlow - capex;

  return {
    fiscalYear: anchor.fy ?? null,
    fiscalQuarter: anchor.fp ?? null,
    periodStart: anchor.start ?? null,
    periodEnd: anchor.end,
    filedAt: anchor.filed ?? null,
    form: anchor.form,
    accessionNumber: anchor.accn ?? null,
    revenue: values.revenue,
    netIncome: values.netIncome,
    epsDiluted: values.epsDiluted,
    operatingCashFlow: values.operatingCashFlow,
    capitalExpenditure: capex,
    freeCashFlow,
    grossProfit: values.grossProfit,
    operatingIncome: values.operatingIncome,
    assets: values.assets,
    liabilities: values.liabilities,
    equity: values.equity,
    cash: values.cash,
    sharesOutstanding: values.sharesOutstanding,
    conceptsUsed,
    calculatedFields: freeCashFlow === null ? [] : ["freeCashFlow"]
  };
}

function findMatchingUnit(units: SecFactUnit[], anchor: SecFactUnit, kind: "annual" | "quarterly") {
  const candidates = units.filter((unit) => unit.end === anchor.end && unit.form === anchor.form && unit.fy === anchor.fy && unit.fp === anchor.fp);
  const durationFiltered = candidates.filter((unit) => {
    if (!unit.start) return true;
    const days = (new Date(unit.end ?? "").getTime() - new Date(unit.start).getTime()) / 86400000;
    return kind === "annual" ? days > 300 : days > 60 && days < 130;
  });
  return [...(durationFiltered.length ? durationFiltered : candidates)].sort((a, b) => (b.filed ?? "").localeCompare(a.filed ?? ""))[0] ?? null;
}

function isCoreForm(unit: SecFactUnit) {
  return (unit.form === "10-K" || unit.form === "10-Q") && typeof unit.val === "number" && Number.isFinite(unit.val) && Boolean(unit.end);
}
