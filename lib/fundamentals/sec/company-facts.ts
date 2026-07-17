import { fetchCompanyFacts } from "@/lib/fundamentals/sec/client";
import { getCikByTicker } from "@/lib/fundamentals/sec/cik-map";
import { normalizeCompanyFacts } from "@/lib/fundamentals/sec/normalize";
import type { NormalizedFundamentals } from "@/lib/fundamentals/sec/types";

export async function getSecFundamentals(symbol: string): Promise<NormalizedFundamentals> {
  const normalized = symbol.trim().toUpperCase();
  const cik = await getCikByTicker(normalized);
  if (!cik.ok) {
    return {
      symbol: normalized,
      cik: null,
      companyName: null,
      status: "unavailable",
      source: "SEC Company Facts",
      updatedAt: null,
      annual: [],
      quarterly: [],
      warnings: [cik.error.includes("CIK") ? "暂未获得可靠公司财务数据" : cik.error]
    };
  }

  const facts = await fetchCompanyFacts(cik.cik);
  if (!facts.ok) {
    return normalizeCompanyFacts({
      symbol: normalized,
      cik: cik.cik,
      companyName: cik.companyName,
      response: null,
      status: "unavailable",
      updatedAt: null,
      warnings: [facts.error]
    });
  }

  return normalizeCompanyFacts({
    symbol: normalized,
    cik: cik.cik,
    companyName: cik.companyName,
    response: facts.data,
    status: facts.status,
    updatedAt: facts.updatedAt,
    warnings: facts.warning ? [facts.warning] : []
  });
}
