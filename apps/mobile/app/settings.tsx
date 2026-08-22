import Constants from "expo-constants";
import { router } from "expo-router";
import { Pressable, View } from "react-native";
import { Card } from "../src/components/Card.tsx";
import { Header } from "../src/components/Header.tsx";
import { Screen, Stack } from "../src/components/Screen.tsx";
import { ThemedText } from "../src/components/ThemedText.tsx";
import { useLanguage } from "../src/i18n/LanguageProvider.tsx";
import { UI_LANGUAGES, type UiLanguage } from "../src/i18n/strings.ts";
import { useTheme } from "../src/theme/index.ts";

/** App-level settings (design.md §5.6). Text size follows the system; nothing to set here. */
export default function SettingsRoute() {
  const { colors, radius, space } = useTheme();
  const { t, language, setLanguage } = useLanguage();
  return (
    <Screen>
      <Header title={t("settings")} />
      <Stack gap={3}>
        <Card>
          <Stack gap={1.5}>
            <ThemedText variant="label">{t("uiLanguage")}</ThemedText>
            <View style={{ gap: space(1) }}>
              {UI_LANGUAGES.map((candidate) => (
                <LanguageOption
                  key={candidate}
                  code={candidate}
                  selected={candidate === language}
                  onSelect={() => setLanguage(candidate)}
                />
              ))}
            </View>
            <ThemedText variant="caption" tone="muted">
              {t("restartNote")}
            </ThemedText>
          </Stack>
        </Card>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/downloads")}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            padding: space(2),
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <ThemedText variant="label">{t("manageDownloads")}</ThemedText>
          <ThemedText tone="muted">›</ThemedText>
        </Pressable>
        <View
          style={{
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: colors.border,
            padding: space(1.5),
          }}
        >
          <ThemedText variant="caption" tone="muted">
            {t("version")} {Constants.expoConfig?.version ?? "dev"}
          </ThemedText>
        </View>
      </Stack>
    </Screen>
  );
}

function LanguageOption({
  code,
  selected,
  onSelect,
}: {
  code: UiLanguage;
  selected: boolean;
  onSelect: () => void;
}) {
  const { colors, radius, space } = useTheme();
  const { t } = useLanguage();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onSelect}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: space(1.5),
        padding: space(1.5),
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: selected ? colors.primary : colors.border,
        backgroundColor: selected ? colors.surfaceAlt : colors.background,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: 10,
          borderWidth: 2,
          borderColor: selected ? colors.primary : colors.textMuted,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {selected ? (
          <View
            style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary }}
          />
        ) : null}
      </View>
      <ThemedText>{t(`language_${code}`)}</ThemedText>
    </Pressable>
  );
}
