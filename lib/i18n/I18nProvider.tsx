"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import en, { type Dictionary } from "./en";
import kk from "./kk";
import ru from "./ru";

export const LOCALES = ["ru", "kk", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_LABELS: Record<Locale, string> = { ru: "Рус", kk: "Қаз", en: "Eng" };

const DICTIONARIES: Record<Locale, Dictionary> = { ru, kk, en };
// BCP-47 tags for Intl date/number formatting.
const INTL_LOCALES: Record<Locale, string> = { ru: "ru-RU", kk: "kk-KZ", en: "en-GB" };
const STORAGE_KEY = "bf.locale";
// SRS §5: Russian and Kazakh first; Russian is the default.
const DEFAULT_LOCALE: Locale = "ru";

type I18nContextValue = {
  locale: Locale;
  intlLocale: string;
  t: Dictionary;
  setLocale: (locale: Locale) => void;
};

const I18nContext = createContext<I18nContextValue | null>(null);

/** Replaces `{name}` placeholders: fmt("Hi {name}", { name: "Berik" }). */
export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  );
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Locale | null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from localStorage after hydration
      if (saved && LOCALES.includes(saved)) setLocaleState(saved);
    } catch {
      // Storage unavailable (private mode): keep the default.
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Ignore: the choice still applies for this session.
    }
  }, []);

  const value = useMemo(
    () => ({ locale, intlLocale: INTL_LOCALES[locale], t: DICTIONARIES[locale], setLocale }),
    [locale, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used within I18nProvider");
  return context;
}
