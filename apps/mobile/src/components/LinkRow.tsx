import { openURL } from "expo-linking";
import { Pressable, View } from "react-native";
import { useLanguage } from "../i18n/LanguageProvider.tsx";
import { useTheme } from "../theme/index.ts";
import { ThemedText } from "./ThemedText.tsx";

interface LinkRowProps {
  label: string;
  detail?: string;
  href?: string | null;
  onPress?: () => void;
}

/** A tappable row for support, legal, and emergency entries; opens a URL or calls back. */
export function LinkRow({ label, detail, href, onPress }: LinkRowProps) {
  const { colors, space } = useTheme();
  const { isRTL } = useLanguage();
  const handler = onPress ?? (href ? () => void openURL(href) : undefined);
  return (
    <Pressable
      accessibilityRole={handler ? "link" : undefined}
      onPress={handler}
      disabled={!handler}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: space(1.5),
        paddingVertical: space(1.5),
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <ThemedText>{label}</ThemedText>
        {detail ? (
          <ThemedText variant="caption" tone="muted">
            {detail}
          </ThemedText>
        ) : null}
      </View>
      {handler ? <ThemedText tone="muted">{isRTL ? "‹" : "›"}</ThemedText> : null}
    </Pressable>
  );
}
