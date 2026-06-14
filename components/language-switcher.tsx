"use client";

import { useLanguage } from "@/components/language-provider";

export function LanguageSwitcher() {
  const { locale, setLocale } = useLanguage();

  return (
    <div className="inline-flex rounded-md border border-slate-700 bg-slate-950 p-1 text-xs font-semibold">
      <button
        type="button"
        onClick={() => setLocale("zh-CN")}
        className={`rounded px-2 py-1 ${locale === "zh-CN" ? "bg-blue-500 text-white" : "text-slate-300 hover:text-white"}`}
      >
        中文
      </button>
      <button
        type="button"
        onClick={() => setLocale("en-US")}
        className={`rounded px-2 py-1 ${locale === "en-US" ? "bg-blue-500 text-white" : "text-slate-300 hover:text-white"}`}
      >
        EN
      </button>
    </div>
  );
}
