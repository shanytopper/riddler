import type { Station } from "@riddles/bundle-schema";
import { nextStation, stationState } from "@riddles/game-core";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { bundleMapSource } from "../../../src/bundles/bundleStore.ts";
import { Button } from "../../../src/components/Button.tsx";
import { ThemedText } from "../../../src/components/ThemedText.tsx";
import { delivery } from "../../../src/delivery/client.ts";
import { useLanguage } from "../../../src/i18n/LanguageProvider.tsx";
import { usePosition } from "../../../src/location/usePosition.ts";
// No extension: Metro picks TrackMap.web.tsx on web and TrackMap.tsx on native only for extensionless imports.
import { TrackMap } from "../../../src/map/TrackMap";
import type { StationMarker } from "../../../src/map/types.ts";
import { usePlay } from "../../../src/play/PlayProvider.tsx";
import { StationPanel, answerText } from "../../../src/play/StationPanel.tsx";
import { ThemeProvider, useTheme } from "../../../src/theme/index.ts";
import type { ThemeInput } from "../../../src/theme/tokens.ts";

/** The play screen (design.md §5.3): the map above, the station in play below. */
export default function PlayRoute() {
  const { trackId } = useLocalSearchParams<{ trackId: string }>();
  const { session, restored, resumePlay } = usePlay();
  const { t } = useLanguage();
  const [theme, setTheme] = useState<ThemeInput | null>(null);
  const matches = session?.bundle.trackId === trackId;

  useEffect(() => {
    let cancelled = false;
    if (!trackId) return;
    void delivery.getTrack(trackId).then((found) => {
      if (!cancelled && found) setTheme(found.tenant.theme);
    });
    return () => {
      cancelled = true;
    };
  }, [trackId]);

  // Resume the clock when the play screen opens (also covers a restored, paused session).
  useEffect(() => {
    if (matches) resumePlay();
  }, [matches, resumePlay]);

  useEffect(() => {
    if (session?.state.status === "finished") router.replace(`/t/${trackId}/finish`);
  }, [session?.state.status, trackId]);

  // Wait for the launch-time restore before deciding there is nothing to play.
  if (!restored) return <View style={{ flex: 1 }} />;

  if (!session || !matches) {
    return (
      <View
        style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 }}
      >
        <ThemedText tone="muted">{t("noSession")}</ThemedText>
        <Button
          label={t("back")}
          variant="secondary"
          onPress={() => router.replace(`/t/${trackId}`)}
        />
      </View>
    );
  }
  return (
    <ThemeProvider theme={theme ?? undefined}>
      <PlayScreen />
    </ThemeProvider>
  );
}

function PlayScreen() {
  const { colors, scheme, space } = useTheme();
  const { t, localized } = useLanguage();
  const insets = useSafeAreaInsets();
  const play = usePlay();
  const session = play.session!;
  const { bundle, state } = session;
  const content = bundle.content;
  const leg = content.legs[state.legIndex] ?? content.legs[content.legs.length - 1]!;
  const { position } = usePosition(true);
  const [celebration, setCelebration] = useState<{
    stationId: string;
    points: number;
    revealed: string | null;
  } | null>(null);

  const current: Station | null = useMemo(() => {
    const linear = nextStation(content, state);
    if (linear) return linear;
    return (
      leg.stations.find((station) => stationState(state, station.id).status === "arrived") ?? null
    );
  }, [content, state, leg]);

  const markers = useMemo<StationMarker[]>(
    () =>
      leg.stations.map((station, index) => {
        const status = stationState(state, station.id).status;
        const isCurrent = current?.id === station.id;
        return {
          id: station.id,
          lng: station.location?.lng ?? 0,
          lat: station.location?.lat ?? 0,
          label: String(index + 1),
          state:
            status === "completed"
              ? "done"
              : isCurrent
                ? "current"
                : status === "hidden"
                  ? "hidden"
                  : "upcoming",
        };
      }),
    [leg, state, current],
  );

  const mapSource = useMemo(
    () => bundleMapSource(bundle, leg.id, scheme),
    [bundle, leg.id, scheme],
  );
  const done = leg.stations.filter(
    (station) => stationState(state, station.id).status === "completed",
  ).length;
  const { language } = useLanguage();

  const confirmLeave = () => {
    Alert.alert(t("leaveTrack"), t("leaveConfirm"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("leave"),
        style: "destructive",
        onPress: () => {
          play.leave();
          router.replace(`/t/${bundle.trackId}`);
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: space(2),
          paddingVertical: space(1),
          gap: space(1.5),
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("leaveTrack")}
          onPress={confirmLeave}
          hitSlop={12}
        >
          <ThemedText variant="heading">×</ThemedText>
        </Pressable>
        <ThemedText variant="label" numberOfLines={1} style={{ flex: 1 }}>
          {localized(content.name)}
        </ThemedText>
        <ThemedText variant="label" tone="muted">
          {t("progress", { done, total: leg.stations.length })}
        </ThemedText>
        <ThemedText variant="label">{t("points", { n: state.score })}</ThemedText>
      </View>

      <View style={{ height: "38%" }}>
        <TrackMap
          bounds={leg.map.kind === "tiles" ? leg.map.bounds : [34.8, 32.09, 34.82, 32.11]}
          minZoom={leg.map.kind === "tiles" ? leg.map.minZoom : 13}
          maxZoom={leg.map.kind === "tiles" ? leg.map.maxZoom : 18}
          stations={markers}
          position={position}
          source={mapSource}
        />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: space(2), paddingBottom: insets.bottom + space(3) }}
        keyboardShouldPersistTaps="handled"
      >
        {celebration ? (
          <View
            style={{
              gap: space(2),
              padding: space(2),
              borderRadius: 16,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              marginBottom: space(2),
            }}
          >
            <ThemedText variant="title" tone="primary">
              {celebration.revealed === null
                ? t("correct")
                : t("answerWas", { answer: celebration.revealed })}
            </ThemedText>
            <ThemedText variant="heading">
              {t("pointsEarned", { n: celebration.points })}
            </ThemedText>
            <Button label={t("next")} variant="accent" onPress={() => setCelebration(null)} />
          </View>
        ) : null}
        {current && !celebration ? (
          <StationPanel
            bundle={bundle}
            content={content}
            state={state}
            station={current}
            stationNumber={leg.stations.indexOf(current) + 1}
            position={position}
            onArrive={(method) => play.arrive(current.id, method)}
            onRevealHint={() => play.revealHint(current.id)}
            onSubmit={(input) => {
              const result = play.submitAnswer(current.id, input);
              if (result.correct) {
                setCelebration({
                  stationId: current.id,
                  points: result.points ?? 0,
                  revealed: null,
                });
              }
              return result;
            }}
            onRevealAndContinue={() => {
              const answer = current.challenge
                ? answerText(current.challenge, localized, language)
                : "";
              play.revealAndContinue(current.id);
              setCelebration({ stationId: current.id, points: 0, revealed: answer });
            }}
          />
        ) : null}
        {!current && !celebration && !state.legStarted && state.status === "paused" ? (
          <Button label={t("continueTrack")} variant="accent" onPress={() => play.startNextLeg()} />
        ) : null}
      </ScrollView>
    </View>
  );
}
