import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { I18nManager, Platform } from "react-native";
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
  /** Direction of the UI language. Native layout mirroring is synced to it via I18nManager (D35). */
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

/**
 * Mirrors the native layout to the UI language (D35): Hebrew → RTL, English → LTR. React Native
 * fixes the layout direction at native startup, so a change only takes effect after the app is
 * relaunched — the Settings screen's restart note says so. On a device whose system language already
 * matches (e.g. a Hebrew phone for the Hebrew default) the first launch is already correct; only a
 * mismatched device (e.g. an English emulator) needs the one-time restart. No-op on web, where the
 * direction is set through `document.dir` instead.
 */
const syncLayoutDirection = (language: UiLanguage): void => {
  if (Platform.OS === "web") return;
  const wantRTL = isRtl(language);
  I18nManager.allowRTL(true);
  if (I18nManager.isRTL !== wantRTL) I18nManager.forceRTL(wantRTL);
};

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<UiLanguage>(initialLanguage);
  const isRTL = isRtl(language);

  const setLanguage = (next: UiLanguage) => {
    setSetting(LANGUAGE_KEY, next);
    setLanguageState(next);
  };

  // Keep the native layout direction aligned with the language (applies on the next restart).
  useEffect(() => {
    syncLayoutDirection(language);
  }, [language]);

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
