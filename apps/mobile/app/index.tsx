import Constants from "expo-constants";
import { Redirect, router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { Button } from "../src/components/Button.tsx";
import { Card } from "../src/components/Card.tsx";
import { Screen, Stack } from "../src/components/Screen.tsx";
import { ThemedText } from "../src/components/ThemedText.tsx";
import { delivery } from "../src/delivery/client.ts";
import { normalizeVenueCode } from "../src/delivery/links.ts";
import type { VenueSummary } from "../src/delivery/types.ts";
import { useLanguage } from "../src/i18n/LanguageProvider.tsx";
import { useRecentVenues } from "../src/state/RecentVenues.tsx";
import { useTheme } from "../src/theme/index.ts";

const configured: unknown = Constants.expoConfig?.extra?.pinnedTenant;
const pinnedTenant = typeof configured === "string" && configured.length > 0 ? configured : null;

/** The umbrella app's front door (design.md §5.1). A dedicated build never shows it. */
export default function UmbrellaHome() {
  if (pinnedTenant) return <Redirect href={`/v/${pinnedTenant}`} />;
  return <UmbrellaHomeContent />;
}

function UmbrellaHomeContent() {
  const { colors, fonts, radius, space } = useTheme();
  const { t } = useLanguage();
  const { venues: recent } = useRecentVenues();
  const [nearby, setNearby] = useState<VenueSummary[]>([]);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void delivery.nearbyVenues().then((venues) => {
      if (!cancelled) setNearby(venues);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const submitCode = () => {
    const slug = normalizeVenueCode(code);
    if (!slug) {
      setCodeError(true);
      return;
    }
    setCodeError(false);
    router.push(`/v/${slug}`);
  };

  return (
    <Screen>
      <Stack gap={3}>
        <View style={{ paddingTop: space(4), gap: space(1) }}>
          <ThemedText variant="title">{t("appName")}</ThemedText>
          <ThemedText tone="muted">{t("tagline")}</ThemedText>
        </View>

        <Button label={t("scanVenueCode")} onPress={() => router.push("/scan")} />

        <Card>
          <Stack gap={1.5}>
            <ThemedText variant="label">{t("enterVenueCode")}</ThemedText>
            <View style={{ flexDirection: "row", gap: space(1) }}>
              <TextInput
                value={code}
                onChangeText={(text) => {
                  setCode(text);
                  setCodeError(false);
                }}
                onSubmitEditing={submitCode}
                placeholder={t("venueCodePlaceholder")}
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="go"
                accessibilityLabel={t("enterVenueCode")}
                style={{
                  flex: 1,
                  minHeight: 48,
                  borderWidth: 1,
                  borderColor: codeError ? colors.danger : colors.border,
                  borderRadius: radius.md,
                  paddingHorizontal: space(1.5),
                  color: colors.text,
                  backgroundColor: colors.background,
                  fontSize: 16,
                  fontFamily: fonts.regular,
                }}
              />
              <Button label={t("go")} variant="accent" onPress={submitCode} />
            </View>
            {codeError ? (
              <ThemedText variant="caption" tone="danger">
                {t("invalidCode")}
              </ThemedText>
            ) : null}
          </Stack>
        </Card>

        <VenueList title={t("nearYou")} venues={nearby} />
        <VenueList title={t("recent")} venues={recent} empty={t("noRecent")} />

        <Pressable
          accessibilityRole="link"
          onPress={() => router.push("/settings")}
          style={{ alignSelf: "flex-start", paddingVertical: space(1) }}
        >
          <ThemedText tone="primary">{t("settings")}</ThemedText>
        </Pressable>
      </Stack>
    </Screen>
  );
}

function VenueList({
  title,
  venues,
  empty,
}: {
  title: string;
  venues: VenueSummary[];
  empty?: string;
}) {
  const { colors, radius, space } = useTheme();
  const { localized } = useLanguage();
  if (venues.length === 0 && !empty) return null;
  return (
    <Stack gap={1}>
      <ThemedText variant="label" tone="muted">
        {title}
      </ThemedText>
      {venues.length === 0 ? (
        <ThemedText variant="caption" tone="muted">
          {empty}
        </ThemedText>
      ) : (
        venues.map((venue) => (
          <Pressable
            key={venue.tenantId}
            accessibilityRole="button"
            onPress={() => router.push(`/v/${venue.slug}`)}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: space(1.5),
              padding: space(1.5),
              borderRadius: radius.md,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: radius.sm,
                backgroundColor: colors.primary,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ThemedText variant="label" tone="onPrimary">
                {localized(venue.displayName).trim().charAt(0).toUpperCase()}
              </ThemedText>
            </View>
            <ThemedText style={{ flex: 1 }}>{localized(venue.displayName)}</ThemedText>
          </Pressable>
        ))
      )}
    </Stack>
  );
}
