"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { defaultLocale, supportedLocales, translations, type Locale, type TranslationKey } from "@/lib/i18n";

type LanguageContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);

  useEffect(() => {
    const saved = window.localStorage.getItem("stockradar-locale");
    if (isLocale(saved)) {
      setLocaleState(saved);
    }
  }, []);

  const value = useMemo<LanguageContextValue>(() => {
    function setLocale(nextLocale: Locale) {
      setLocaleState(nextLocale);
      window.localStorage.setItem("stockradar-locale", nextLocale);
    }

    function t(key: TranslationKey, vars?: Record<string, string | number>) {
      let text: string = translations[locale][key] ?? translations[defaultLocale][key] ?? key;
      if (vars) {
        Object.entries(vars).forEach(([name, value]) => {
          text = text.replace(`{${name}}`, String(value));
        });
      }
      return text;
    }

    return { locale, setLocale, t };
  }, [locale]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used inside LanguageProvider");
  }
  return context;
}

function isLocale(value: string | null): value is Locale {
  return supportedLocales.includes(value as Locale);
}
