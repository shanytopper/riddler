import type { Tenant } from "@riddles/bundle-schema";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Share, Switch, View } from "react-native";
import { Button } from "../../../src/components/Button.tsx";
import { Card } from "../../../src/components/Card.tsx";
import { Screen, Stack } from "../../../src/components/Screen.tsx";
import { ThemedText } from "../../../src/components/ThemedText.tsx";
import { API_URL, delivery } from "../../../src/delivery/client.ts";
import { useLanguage } from "../../../src/i18n/LanguageProvider.tsx";
import { formatPlayTime } from "../../../src/i18n/strings.ts";
import { distanceMeters } from "../../../src/map/geo.ts";
import { usePlay } from "../../../src/play/PlayProvider.tsx";
import { Blocks } from "../../../src/play/StationPanel.tsx";
import { ThemeProvider, useTheme } from "../../../src/theme/index.ts";

/** The result card (design.md §5.3). The leaderboard itself arrives with the API in step 7. */
export default function FinishRoute() {
  const { trackId } = useLocalSearchParams<{ trackId: string }>();
  const { session } = usePlay();
  const { t } = useLanguage();
  const [tenant, setTenant] = useState<Tenant | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!trackId) return;
    void delivery.getTrack(trackId).then((found) => {
      if (!cancelled && found) setTenant(found.tenant);
    });
    return () => {
      cancelled = true;
    };
  }, [trackId]);

  if (!session || session.bundle.trackId !== trackId || !session.state.finished) {
    return (
      <Screen>
        <Stack gap={2}>
          <ThemedText tone="muted">{t("noSession")}</ThemedText>
          <Button
            label={t("back")}
            variant="secondary"
            onPress={() => router.replace(`/t/${trackId}`)}
          />
        </Stack>
      </Screen>
    );
  }
  return (
    <ThemeProvider theme={tenant?.theme}>
      <ResultCard tenant={tenant} />
    </ThemeProvider>
  );
}

function ResultCard({ tenant }: { tenant: Tenant | null }) {
  const { colors, radius, space } = useTheme();
  const { t, localized } = useLanguage();
  const play = usePlay();
  const session = play.session!;
  const { bundle, state } = session;
  const finished = state.finished!;
  const time = formatPlayTime(finished.playTimeMs);
  const date = new Date().toLocaleDateString();
  const track = localized(bundle.content.name);
  // The track's finish is the last leg's `end`, its meeting point the first leg's `start` (D36).
  const lastLeg = bundle.content.legs[bundle.content.legs.length - 1];
  const end = lastLeg?.end ?? null;
  const endLocation = end?.location;
  const startLocation = bundle.content.legs[0]?.start?.location;
  // A circular route ends where it began; within a meter counts as the same spot.
  const circular =
    endLocation !== undefined &&
    startLocation !== undefined &&
    distanceMeters(startLocation, endLocation) < 1;
  const endNote = end?.note ? localized(end.note) : "";

  const share = () => {
    void Share.share({
      message: t("shareMessage", { team: state.teamName, track, score: finished.score, time }),
    });
  };

  const backToVenue = () => {
    play.clear();
    router.replace(tenant ? `/v/${tenant.slug}` : "/");
  };

  return (
    <Screen>
      <Stack gap={3}>
        <View style={{ paddingTop: space(4), gap: space(1) }}>
          <ThemedText variant="title">{t("finished")}</ThemedText>
          <ThemedText tone="muted">{track}</ThemedText>
        </View>

        <View
          style={{
            backgroundColor: colors.primary,
            borderRadius: radius.lg,
            padding: space(3),
            gap: space(2),
          }}
        >
          <ThemedText variant="label" tone="onPrimary" style={{ opacity: 0.8 }}>
            {tenant ? localized(tenant.displayName) : t("appName")}
          </ThemedText>
          <ThemedText variant="title" tone="onPrimary">
            {state.teamName}
          </ThemedText>
          <View style={{ flexDirection: "row", gap: space(4) }}>
            <View>
              <ThemedText variant="caption" tone="onPrimary" style={{ opacity: 0.8 }}>
                {t("score")}
              </ThemedText>
              <ThemedText variant="title" tone="onPrimary">
                {finished.score}
              </ThemedText>
            </View>
            <View>
              <ThemedText variant="caption" tone="onPrimary" style={{ opacity: 0.8 }}>
                {t("playTime")}
              </ThemedText>
              <ThemedText variant="title" tone="onPrimary">
                {time}
              </ThemedText>
            </View>
          </View>
          <ThemedText variant="caption" tone="onPrimary" style={{ opacity: 0.8 }}>
            {date}
          </ThemedText>
        </View>

        <Blocks bundle={bundle} blocks={lastLeg?.outro ?? []} />

        {end ? (
          <Card>
            <Stack gap={1}>
              <ThemedText variant="label">
                {t(circular ? "trailEndsAtStart" : "trailEndsHere")}
              </ThemedText>
              {endNote ? <ThemedText>{endNote}</ThemedText> : null}
            </Stack>
          </Card>
        ) : null}

        {bundle.content.rules.leaderboard ? (
          <Card>
            <View style={{ flexDirection: "row", alignItems: "center", gap: space(2) }}>
              <View style={{ flex: 1, gap: 4 }}>
                <ThemedText variant="label">{t("postToLeaderboard")}</ThemedText>
                <ThemedText variant="caption" tone="muted">
                  {t("leaderboardLater")}
                </ThemedText>
              </View>
              <Switch
                value={state.leaderboardOptIn}
                onValueChange={(value) => play.setLeaderboardOptIn(value)}
                trackColor={{ true: colors.accent, false: colors.border }}
                accessibilityLabel={t("postToLeaderboard")}
              />
            </View>
          </Card>
        ) : null}

        {bundle.content.rules.leaderboard && API_URL ? (
          <Button
            label={t("viewLeaderboard")}
            variant="secondary"
            onPress={() => router.push(`/t/${bundle.trackId}/leaderboard`)}
          />
        ) : null}

        <Button label={t("share")} variant="secondary" onPress={share} />
        <Button
          label={t("backToVenue", { venue: tenant ? localized(tenant.displayName) : t("appName") })}
          variant="accent"
          onPress={backToVenue}
        />
      </Stack>
    </Screen>
  );
}
