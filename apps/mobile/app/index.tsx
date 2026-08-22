import Constants from "expo-constants";
import { Redirect, router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { Button } from "../src/components/Button.tsx";
import { Screen, Stack } from "../src/components/Screen.tsx";
import { ThemedText } from "../src/components/ThemedText.tsx";
import { TrackCard } from "../src/components/TrackCard.tsx";
import { delivery } from "../src/delivery/client.ts";
import type { TrackSummary } from "../src/delivery/types.ts";
import { useLanguage } from "../src/i18n/LanguageProvider.tsx";
import { useTheme } from "../src/theme/index.ts";

const configured: unknown = Constants.expoConfig?.extra?.pinnedTenant;
const pinnedTenant = typeof configured === "string" && configured.length > 0 ? configured : null;

/** The umbrella app's front door (design.md §5.1). A dedicated build never shows it. */
export default function UmbrellaHome() {
  if (pinnedTenant) return <Redirect href={`/v/${pinnedTenant}`} />;
  return <UmbrellaHomeContent />;
}

type TrackList =
  { status: "loading" } | { status: "error" } | { status: "ready"; tracks: TrackSummary[] };

/**
 * Prototype only (owner, 2026-08-22, D35): instead of scanning or typing a venue code, the umbrella
 * home lists the tracks published on the server and the player picks one. For v1, restore the
 * venue-code entry, QR scan, and the nearby/recent venue lists (see git history for this file).
 */
function UmbrellaHomeContent() {
  const { space } = useTheme();
  const { t } = useLanguage();
  const [state, setState] = useState<TrackList>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    void delivery.listAllTracks().then((tracks) => {
      if (cancelled) return;
      // null means the server was unreachable; an empty array means it has no tracks.
      setState(tracks === null ? { status: "error" } : { status: "ready", tracks });
    });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  return (
    <Screen>
      <Stack gap={3}>
        <View style={{ paddingTop: space(4), gap: space(1) }}>
          <ThemedText variant="title">{t("appName")}</ThemedText>
          <ThemedText tone="muted">{t("tagline")}</ThemedText>
        </View>

        <Stack gap={1.5}>
          <ThemedText variant="label" tone="muted">
            {t("tracks")}
          </ThemedText>
          {state.status === "loading" ? (
            <ThemedText tone="muted">{t("loading")}</ThemedText>
          ) : state.status === "error" ? (
            <Stack gap={1.5}>
              <ThemedText tone="muted">{t("tracksUnavailable")}</ThemedText>
              <Button
                label={t("retry")}
                variant="secondary"
                onPress={() => setReloadKey((key) => key + 1)}
              />
            </Stack>
          ) : state.tracks.length === 0 ? (
            <ThemedText tone="muted">{t("noTracks")}</ThemedText>
          ) : (
            state.tracks.map((track) => <TrackCard key={track.trackId} track={track} />)
          )}
        </Stack>

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
