import { prisma } from "@/lib/prisma";
import { RepositoryError } from "@/lib/repositories/shared";

export async function getDailyReports() {
  try {
    return await prisma.dailyReport.findMany({ orderBy: { reportDate: "desc" } });
  } catch (cause) {
    throw new RepositoryError("每日报告暂时不可用。", cause);
  }
}

export async function upsertDailyReport(reportDate: string, reportContent: unknown, summaryText?: string | null) {
  const date = new Date(`${reportDate.slice(0, 10)}T00:00:00.000Z`);
  return prisma.dailyReport.upsert({
    where: { reportDate: date },
    update: { reportContent: reportContent as object, summaryText: summaryText ?? null },
    create: { reportDate: date, reportContent: reportContent as object, summaryText: summaryText ?? null }
  });
}
