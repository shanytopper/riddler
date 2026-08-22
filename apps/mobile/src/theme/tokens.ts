import type { Tenant } from "@riddles/bundle-schema";

export type ThemeInput = Tenant["theme"];
export type Typography = ThemeInput["typography"];

export interface ThemeFonts {
  /** Font family name as registered with expo-font; undefined means the platform default. */
  regular: string | undefined;
  bold: string | undefined;
}

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  textMuted: string;
  border: string;
  primary: string;
  onPrimary: string;
  accent: string;
  onAccent: string;
  danger: string;
}

export interface ThemeTokens {
  scheme: "light" | "dark";
  colors: ThemeColors;
  fonts: ThemeFonts;
  radius: { sm: number; md: number; lg: number };
  /** Spacing on an 8-point grid: space(2) === 16. */
  space: (units: number) => number;
}

export const FONT_FAMILIES: Record<Typography, ThemeFonts> = {
  heebo: { regular: "Heebo_400Regular", bold: "Heebo_700Bold" },
  assistant: { regular: "Assistant_400Regular", bold: "Assistant_700Bold" },
  rubik: { regular: "Rubik_400Regular", bold: "Rubik_700Bold" },
  system: { regular: undefined, bold: undefined },
};

/** The umbrella app's own look, used until a venue is entered. */
export const NEUTRAL_THEME: ThemeInput = {
  primary: "#2F3E46",
  onPrimary: "#FFFFFF",
  accent: "#E9C46A",
  onAccent: "#1A1A1A",
  background: "light",
  typography: "system",
  logoUrl: null,
  logoDarkUrl: null,
  coverUrl: null,
};

const LIGHT_SURFACES = {
  background: "#FFFFFF",
  surface: "#F5F5F2",
  surfaceAlt: "#EAEAE5",
  text: "#1A1A1A",
  textMuted: "#5F6368",
  border: "#DADAD5",
};

const DARK_SURFACES = {
  background: "#121212",
  surface: "#1E1E1E",
  surfaceAlt: "#2A2A2A",
  text: "#F2F2F2",
  textMuted: "#B0B0B0",
  border: "#3A3A3A",
};

/** Derives the full set of UI tokens from the tenant's theme; everything visible comes from here. */
export function buildTheme(input: ThemeInput): ThemeTokens {
  const dark = input.background === "dark";
  return {
    scheme: dark ? "dark" : "light",
    colors: {
      ...(dark ? DARK_SURFACES : LIGHT_SURFACES),
      primary: input.primary,
      onPrimary: input.onPrimary,
      accent: input.accent,
      onAccent: input.onAccent,
      danger: "#B3261E",
    },
    fonts: FONT_FAMILIES[input.typography],
    radius: { sm: 6, md: 12, lg: 20 },
    space: (units) => units * 8,
  };
}
