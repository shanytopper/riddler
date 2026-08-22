import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "../theme/index.ts";
import { ThemedText } from "./ThemedText.tsx";

type Variant = "primary" | "accent" | "secondary" | "ghost";

export interface ButtonProps extends Omit<PressableProps, "style" | "children"> {
  label: string;
  variant?: Variant;
  style?: StyleProp<ViewStyle>;
}

export function Button({ label, variant = "primary", disabled, style, ...rest }: ButtonProps) {
  const { colors, radius, space } = useTheme();
  const fill =
    variant === "primary"
      ? colors.primary
      : variant === "accent"
        ? colors.accent
        : variant === "secondary"
          ? colors.surfaceAlt
          : "transparent";
  const tone =
    variant === "primary"
      ? "onPrimary"
      : variant === "accent"
        ? "onAccent"
        : variant === "ghost"
          ? "primary"
          : "text";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled ?? false }}
      disabled={disabled}
      {...rest}
      style={({ pressed }) => [
        {
          backgroundColor: fill,
          borderRadius: radius.md,
          paddingVertical: space(1.75),
          paddingHorizontal: space(2.5),
          alignItems: "center",
          justifyContent: "center",
          minHeight: 48,
          opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
          borderWidth: variant === "ghost" ? 1 : 0,
          borderColor: colors.border,
        },
        style,
      ]}
    >
      <ThemedText variant="label" tone={tone} center>
        {label}
      </ThemedText>
    </Pressable>
  );
}
