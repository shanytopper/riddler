import { createContext, useContext, useMemo, type ReactNode } from "react";
import { NEUTRAL_THEME, buildTheme, type ThemeInput, type ThemeTokens } from "./tokens.ts";

const ThemeContext = createContext<ThemeTokens>(buildTheme(NEUTRAL_THEME));

/**
 * Provides UI tokens to its subtree. The root layout mounts it without a theme (the umbrella look);
 * venue and track screens mount it again with the tenant's theme so everything inside is branded.
 */
export function ThemeProvider({ theme, children }: { theme?: ThemeInput; children: ReactNode }) {
  const tokens = useMemo(() => buildTheme(theme ?? NEUTRAL_THEME), [theme]);
  return <ThemeContext.Provider value={tokens}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeTokens {
  return useContext(ThemeContext);
}
