import { Text, type TextProps } from "react-native";
import { useLanguage } from "../i18n/LanguageProvider.tsx";
import { useTheme, type ThemeTokens } from "../theme/index.ts";

type Variant = "title" | "heading" | "body" | "label" | "caption";
type Tone = "text" | "muted" | "primary" | "onPrimary" | "onAccent" | "danger";

const SIZES: Record<Variant, { fontSize: number; lineHeight: number; bold: boolean }> = {
  title: { fontSize: 28, lineHeight: 34, bold: true },
  heading: { fontSize: 20, lineHeight: 26, bold: true },
  body: { fontSize: 16, lineHeight: 23, bold: false },
  label: { fontSize: 14, lineHeight: 18, bold: true },
  caption: { fontSize: 13, lineHeight: 18, bold: false },
};

const toneColor = (colors: ThemeTokens["colors"], tone: Tone): string => {
  switch (tone) {
    case "muted":
      return colors.textMuted;
    case "primary":
      return colors.primary;
    case "onPrimary":
      return colors.onPrimary;
    case "onAccent":
      return colors.onAccent;
    case "danger":
      return colors.danger;
    default:
      return colors.text;
  }
};

export interface ThemedTextProps extends TextProps {
  variant?: Variant;
  tone?: Tone;
  center?: boolean;
}

/** Every piece of text in the app: theme font, theme color, writing direction of the UI language. */
export function ThemedText({
  variant = "body",
  tone = "text",
  center = false,
  style,
  ...rest
}: ThemedTextProps) {
  const { colors, fonts } = useTheme();
  const { isRTL } = useLanguage();
  const size = SIZES[variant];
  const family = size.bold ? fonts.bold : fonts.regular;
  return (
    <Text
      {...rest}
      style={[
        {
          fontSize: size.fontSize,
          lineHeight: size.lineHeight,
          color: toneColor(colors, tone),
          writingDirection: isRTL ? "rtl" : "ltr",
          textAlign: center ? "center" : undefined,
          fontFamily: family,
          fontWeight: family ? undefined : size.bold ? "700" : "400",
        },
        style,
      ]}
    />
  );
}
