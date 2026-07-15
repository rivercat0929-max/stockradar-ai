import type { MarketEvent } from "@/lib/events/types";

// Official 2026 static calendar, manually maintained from public .gov release schedules:
// Federal Reserve FOMC calendar: https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm
// BLS release calendar: https://www.bls.gov/schedule/news_release/
// BEA release schedule: https://www.bea.gov/news/schedule
export const economicCalendar2026: MarketEvent[] = [
  fomc("2026-01-28", "FOMC 利率决议"),
  fomc("2026-03-18", "FOMC 利率决议与经济预测摘要"),
  fomc("2026-04-29", "FOMC 利率决议"),
  fomc("2026-06-17", "FOMC 利率决议与经济预测摘要"),
  fomc("2026-07-29", "FOMC 利率决议"),
  fomc("2026-09-16", "FOMC 利率决议与经济预测摘要"),
  fomc("2026-10-28", "FOMC 利率决议"),
  fomc("2026-12-09", "FOMC 利率决议与经济预测摘要"),

  bls("nonfarm-payrolls", "2026-07-02T08:30:00-04:00", "非农就业报告", "Employment Situation, June 2026"),
  bls("cpi", "2026-07-14T08:30:00-04:00", "CPI 通胀数据", "Consumer Price Index, June 2026"),
  bls("ppi", "2026-07-15T08:30:00-04:00", "PPI 生产者价格指数", "Producer Price Index, June 2026"),
  bls("nonfarm-payrolls", "2026-08-07T08:30:00-04:00", "非农就业报告", "Employment Situation, July 2026"),
  bls("cpi", "2026-08-12T08:30:00-04:00", "CPI 通胀数据", "Consumer Price Index, July 2026"),
  bls("ppi", "2026-08-13T08:30:00-04:00", "PPI 生产者价格指数", "Producer Price Index, July 2026"),
  bls("nonfarm-payrolls", "2026-09-04T08:30:00-04:00", "非农就业报告", "Employment Situation, August 2026"),

  bea("2026-07-30T08:30:00-04:00", "GDP 初值", "GDP (Advance Estimate), 2nd Quarter 2026"),
  bea("2026-08-26T08:30:00-04:00", "GDP 二次估值", "GDP (Second Estimate) and Corporate Profits, 2nd Quarter 2026"),
  bea("2026-09-30T08:30:00-04:00", "GDP 三次估值", "GDP (Third Estimate), 2nd Quarter 2026"),
  bea("2026-10-29T08:30:00-04:00", "GDP 初值", "GDP (Advance Estimate), 3rd Quarter 2026"),
  bea("2026-11-25T08:30:00-05:00", "GDP 二次估值", "GDP (Second Estimate) and Corporate Profits, 3rd Quarter 2026"),
  bea("2026-12-23T08:30:00-05:00", "GDP 三次估值", "GDP (Third Estimate), 3rd Quarter 2026")
];

function fomc(date: string, title: string): MarketEvent {
  return {
    id: `official-fomc-${date}`,
    type: "fomc",
    title,
    description: "Federal Reserve 官方 FOMC 会议日历。声明通常在美东时间下午发布。",
    symbol: null,
    companyName: null,
    startAt: `${date}T14:00:00-04:00`,
    endAt: null,
    timezone: "America/New_York",
    importance: "high",
    dateStatus: "confirmed",
    source: "federal-reserve",
    sourceName: "Federal Reserve",
    sourceUrl: "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm",
    updatedAt: "2026-07-15T00:00:00.000Z",
    fetchedAt: "2026-07-15T00:00:00.000Z",
    isStale: false
  };
}

function bls(type: "cpi" | "ppi" | "nonfarm-payrolls", startAt: string, title: string, description: string): MarketEvent {
  return {
    id: `official-${type}-${startAt.slice(0, 10)}`,
    type,
    title,
    description,
    symbol: null,
    companyName: null,
    startAt,
    endAt: null,
    timezone: "America/New_York",
    importance: "high",
    dateStatus: "confirmed",
    source: "bls",
    sourceName: "BLS",
    sourceUrl: "https://www.bls.gov/schedule/news_release/",
    updatedAt: "2026-07-15T00:00:00.000Z",
    fetchedAt: "2026-07-15T00:00:00.000Z",
    isStale: false
  };
}

function bea(startAt: string, title: string, description: string): MarketEvent {
  return {
    id: `official-gdp-${startAt.slice(0, 10)}`,
    type: "gdp",
    title,
    description,
    symbol: null,
    companyName: null,
    startAt,
    endAt: null,
    timezone: "America/New_York",
    importance: "high",
    dateStatus: "confirmed",
    source: "bea",
    sourceName: "BEA",
    sourceUrl: "https://www.bea.gov/news/schedule",
    updatedAt: "2026-07-15T00:00:00.000Z",
    fetchedAt: "2026-07-15T00:00:00.000Z",
    isStale: false
  };
}
