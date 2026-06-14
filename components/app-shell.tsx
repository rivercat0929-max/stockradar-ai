import Link from "next/link";
import { Disclaimer } from "@/components/disclaimer";

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/holdings", label: "我的持仓" },
  { href: "/radar", label: "选股雷达" },
  { href: "/calendar", label: "事件日历" },
  { href: "/backtest", label: "回测实验室" }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link href="/" className="text-xl font-bold tracking-normal">
              AI 股票雷达 <span className="text-muted">/ StockRadar AI</span>
            </Link>
            <span className="rounded-md border border-line px-3 py-1 text-sm text-muted">MVP Mock</span>
          </div>
          <nav className="flex gap-2 overflow-x-auto">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-muted hover:bg-panel hover:text-ink"
              >
                {item.label}
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
