"use client";

import Link from "next/link";
import { Disclaimer } from "@/components/disclaimer";
import { AccessStatus } from "@/components/access-status";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useLanguage } from "@/components/language-provider";

const navItems = [
  { href: "/", label: "首页" },
  { href: "/holdings", label: "我的持仓" },
  { href: "/ai-score", label: "股票分析" },
  { href: "/watchlist", label: "买卖计划" },
  { href: "/alerts", label: "重要提醒" }
];

const moreTools = [
  { href: "/portfolio", label: "组合分析" },
  { href: "/calendar", label: "Event Calendar" },
  { href: "/daily-report", label: "Daily Report" },
  { href: "/backtest", label: "Backtest" },
  { href: "/screener", label: "AI选股器" },
  { href: "/radar", label: "选股雷达" },
  { href: "/settings", label: "设置与数据" }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-800 bg-slate-950 text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link href="/" className="text-xl font-bold tracking-normal">
              {t("appName")} <span className="text-slate-400">/ StockRadar AI</span>
            </Link>
            <div className="flex items-center gap-3">
              <AccessStatus />
              <span className="rounded-md border border-slate-700 px-3 py-1 text-sm text-slate-300">MVP</span>
              <LanguageSwitcher />
            </div>
          </div>
          <nav className="flex flex-wrap gap-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-900 hover:text-white"
              >
                {item.label}
              </Link>
            ))}
            <details className="relative">
              <summary className="cursor-pointer whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-900 hover:text-white">更多工具</summary>
              <div className="absolute z-20 mt-2 grid min-w-48 gap-1 rounded-md border border-slate-800 bg-slate-950 p-2 shadow-soft">
                {moreTools.map((item) => (
                  <Link key={item.href} href={item.href} className="whitespace-nowrap rounded px-3 py-2 text-sm text-slate-300 hover:bg-slate-900 hover:text-white">
                    {item.label}
                  </Link>
                ))}
              </div>
            </details>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      <footer className="mx-auto max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
        <Disclaimer compact />
      </footer>
    </div>
  );
}
