"use client";

import Link from "next/link";
import { Disclaimer } from "@/components/disclaimer";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useLanguage } from "@/components/language-provider";
import type { TranslationKey } from "@/lib/i18n";

const navItems: { href: string; labelKey: TranslationKey }[] = [
  { href: "/", labelKey: "dashboard" },
  { href: "/holdings", labelKey: "portfolio" },
  { href: "/portfolio", labelKey: "portfolioAnalytics" },
  { href: "/ai-score", labelKey: "aiScore" },
  { href: "/screener", labelKey: "screener" },
  { href: "/alerts", labelKey: "alerts" },
  { href: "/radar", labelKey: "radar" },
  { href: "/calendar", labelKey: "calendar" },
  { href: "/daily-report", labelKey: "dailyReport" },
  { href: "/backtest", labelKey: "backtest" },
  { href: "/settings", labelKey: "settings" }
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
              <span className="rounded-md border border-slate-700 px-3 py-1 text-sm text-slate-300">MVP</span>
              <LanguageSwitcher />
            </div>
          </div>
          <nav className="flex gap-2 overflow-x-auto">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-900 hover:text-white"
              >
                {t(item.labelKey)}
              </Link>
            ))}
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
