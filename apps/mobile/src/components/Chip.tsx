import { View } from "react-native";
import { useTheme } from "../theme/index.ts";
import { ThemedText } from "./ThemedText.tsx";

export function Chip({ label, emphasis = false }: { label: string; emphasis?: boolean }) {
  const { colors, radius, space } = useTheme();
  return (
    <View
      style={{
        backgroundColor: emphasis ? colors.accent : colors.surfaceAlt,
        borderRadius: radius.sm,
        paddingVertical: space(0.5),
        paddingHorizontal: space(1.25),
      }}
    >
      <ThemedText variant="caption" tone={emphasis ? "onAccent" : "text"}>
        {label}
      </ThemedText>
    </View>
  );
}

export function ChipRow({ children }: { children: React.ReactNode }) {
  const { space } = useTheme();
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space(1) }}>{children}</View>;
}
