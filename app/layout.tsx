import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { LanguageProvider } from "@/components/language-provider";

export const metadata: Metadata = {
  title: "StockRadar AI",
  description: "AI 股票雷达 MVP",
  applicationName: "StockRadar AI",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "StockRadar AI",
    statusBarStyle: "default"
  },
  formatDetection: {
    telephone: false
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#111827"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <LanguageProvider>
          <AppShell>{children}</AppShell>
        </LanguageProvider>
      </body>
    </html>
  );
}
