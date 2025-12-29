"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Messages, MessageKey, SupportedLanguage } from "./messages";
import { messages } from "./messages";

type LanguageOption = {
  code: SupportedLanguage;
  label: string;
};

const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
];

type I18nContextValue = {
  lang: SupportedLanguage;
  setLang: (lang: SupportedLanguage) => void;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
  languages: LanguageOption[];
};

const I18nContext = createContext<I18nContextValue | null>(null);

const STORAGE_KEY = "ohara-lang";

export const I18nProvider = ({ children }: { children: React.ReactNode }) => {
  const [lang, setLangState] = useState<SupportedLanguage>("en");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "es" || stored === "en") {
      setLangState(stored);
      return;
    }
    setLangState("en");
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    window.localStorage.setItem(STORAGE_KEY, lang);
  }, [lang]);

  const setLang = useCallback((nextLang: SupportedLanguage) => {
    setLangState(nextLang);
  }, []);

  const t = useCallback(
    (key: MessageKey, vars?: Record<string, string | number>) => {
      const currentMessages: Messages = messages[lang];
      const fallbackMessages: Messages = messages.en;
      const template = currentMessages[key] ?? fallbackMessages[key] ?? key;
      if (!vars) return template;
      return Object.keys(vars).reduce((result, variable) => {
        return result.replace(`{${variable}}`, String(vars[variable]));
      }, template);
    },
    [lang]
  );

  const value = useMemo(
    () => ({
      lang,
      setLang,
      t,
      languages: LANGUAGE_OPTIONS,
    }),
    [lang, setLang, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = () => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return context;
};
