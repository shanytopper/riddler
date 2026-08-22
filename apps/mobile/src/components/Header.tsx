import { router } from "expo-router";
import { Pressable, View } from "react-native";
import { useLanguage } from "../i18n/LanguageProvider.tsx";
import { useTheme } from "../theme/index.ts";
import { ThemedText } from "./ThemedText.tsx";

interface HeaderProps {
  title?: string;
  /** Where "back" goes when there is no history, e.g. after a deep link. */
  fallbackHref?: string;
  onPrimary?: boolean;
}

/** Our own header, so the tenant theme controls it fully and direction is handled in one place. */
export function Header({ title, fallbackHref = "/", onPrimary = false }: HeaderProps) {
  const { colors, space } = useTheme();
  const { t, isRTL } = useLanguage();
  const tone = onPrimary ? "onPrimary" : "text";
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace(fallbackHref);
  };
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: space(1),
        paddingVertical: space(1),
        minHeight: 48,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("back")}
        onPress={goBack}
        hitSlop={12}
        style={({ pressed }) => ({
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: onPrimary ? "rgba(255,255,255,0.18)" : colors.surfaceAlt,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <ThemedText variant="heading" tone={tone} style={{ lineHeight: 24 }}>
          {isRTL ? "›" : "‹"}
        </ThemedText>
      </Pressable>
      {title ? (
        <ThemedText variant="label" tone={tone} numberOfLines={1} style={{ flex: 1 }}>
          {title}
        </ThemedText>
      ) : null}
    </View>
  );
}
