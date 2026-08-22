import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Platform } from "react-native";
import { getSetting, setSetting } from "../db/prefsRepo.ts";
import {
  UI_LANGUAGES,
  isRtl,
  localized as localizedText,
  translate,
  type LocalizedString,
  type StringKey,
  type UiLanguage,
} from "./strings.ts";

export interface LanguageContextValue {
  language: UiLanguage;
  /** Direction of the UI language. Native layout mirroring follows the device via I18nManager. */
  isRTL: boolean;
  setLanguage: (language: UiLanguage) => void;
  t: (key: StringKey, params?: Record<string, string | number>) => string;
  localized: (value: LocalizedString | undefined, fallback?: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

const LANGUAGE_KEY = "language";

/**
 * Prototype only (owner, 2026-08-22): the pilot venue is in Israel, so the app starts in Hebrew
 * regardless of the device language; a saved choice still wins. For v1, restore device-based
 * selection here — `pickLanguage(getLocales().map((l) => l.languageCode ?? ""))` using
 * expo-localization's `getLocales` and `pickLanguage` from ./strings — so travelers get their own
 * language.
 */
const PROTOTYPE_DEFAULT_LANGUAGE: UiLanguage = "he";

/** The saved override if one is set and still supported, else the prototype default (Hebrew). */
const initialLanguage = (): UiLanguage => {
  const saved = getSetting(LANGUAGE_KEY);
  return saved && (UI_LANGUAGES as readonly string[]).includes(saved)
    ? (saved as UiLanguage)
    : PROTOTYPE_DEFAULT_LANGUAGE;
};

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<UiLanguage>(initialLanguage);
  const isRTL = isRtl(language);

  const setLanguage = (next: UiLanguage) => {
    setSetting(LANGUAGE_KEY, next);
    setLanguageState(next);
  };

  useEffect(() => {
    if (Platform.OS === "web" && typeof document !== "undefined") {
      document.documentElement.lang = language;
      document.documentElement.dir = isRTL ? "rtl" : "ltr";
    }
  }, [language, isRTL]);

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      isRTL,
      setLanguage,
      t: (key, params) => translate(language, key, params),
      localized: (text, fallback) => localizedText(text, language, fallback),
    }),
    [language, isRTL],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const value = useContext(LanguageContext);
  if (!value) throw new Error("useLanguage must be used inside LanguageProvider");
  return value;
}
