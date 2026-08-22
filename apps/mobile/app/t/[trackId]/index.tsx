import type { Tenant } from "@riddles/bundle-schema";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Image, View } from "react-native";
import { Button } from "../../../src/components/Button.tsx";
import { Card } from "../../../src/components/Card.tsx";
import { Chip, ChipRow } from "../../../src/components/Chip.tsx";
import { Header } from "../../../src/components/Header.tsx";
import { Screen, Stack } from "../../../src/components/Screen.tsx";
import { ThemedText } from "../../../src/components/ThemedText.tsx";
import { delivery } from "../../../src/delivery/client.ts";
import type { TrackSummary } from "../../../src/delivery/types.ts";
import { useLanguage } from "../../../src/i18n/LanguageProvider.tsx";
import { formatDistance, formatDuration, type StringKey } from "../../../src/i18n/strings.ts";
import { usePlay } from "../../../src/play/PlayProvider.tsx";
import { ThemeProvider, useTheme } from "../../../src/theme/index.ts";

type Loaded =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "ready"; tenant: Tenant; track: TrackSummary };

/** Track details (design.md §5.2); "Start" leads into the start flow, or back into a session in play. */
export default function TrackRoute() {
  const { trackId } = useLocalSearchParams<{ trackId: string }>();
  const [state, setState] = useState<Loaded>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    void (async () => {
      const found = trackId ? await delivery.getTrack(trackId) : null;
      if (cancelled) return;
      setState(found ? { status: "ready", ...found } : { status: "missing" });
    })();
    return () => {
      cancelled = true;
    };
  }, [trackId]);

  if (state.status !== "ready")
    return <Placeholder messageKey={state.status === "loading" ? "loading" : "trackNotFound"} />;
  return (
    <ThemeProvider theme={state.tenant.theme}>
      <TrackDetails tenant={state.tenant} track={state.track} />
    </ThemeProvider>
  );
}

function Placeholder({ messageKey }: { messageKey: "loading" | "trackNotFound" }) {
  const { t } = useLanguage();
  return (
    <Screen>
      <Header />
      <Stack gap={2}>
        <ThemedText tone="muted">{t(messageKey)}</ThemedText>
        {messageKey !== "loading" ? (
          <Button label={t("goHome")} variant="secondary" onPress={() => router.replace("/")} />
        ) : null}
      </Stack>
    </Screen>
  );
}

function TrackDetails({ tenant, track }: { tenant: Tenant; track: TrackSummary }) {
  const { colors, space } = useTheme();
  const { t, language, localized } = useLanguage();
  const { session, restored } = usePlay();
  const inPlay =
    restored &&
    session?.bundle.trackId === track.trackId &&
    (session.state.status === "active" || session.state.status === "paused");
  return (
    <Screen flush>
      <View style={{ backgroundColor: colors.primary, paddingHorizontal: space(2) }}>
        <Header
          fallbackHref={`/v/${tenant.slug}`}
          title={localized(tenant.displayName)}
          onPrimary
        />
      </View>
      {track.coverUrl ? (
        <Image
          source={{ uri: track.coverUrl }}
          style={{ width: "100%", height: 200 }}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
      ) : (
        <View style={{ height: 16, backgroundColor: colors.accent }} />
      )}
      <View style={{ paddingHorizontal: space(2), paddingTop: space(3), gap: space(3) }}>
        <Stack gap={1.5}>
          <ThemedText variant="title">{localized(track.name)}</ThemedText>
          <ChipRow>
            <Chip label={formatDuration(language, track.estimate.durationMinutes)} emphasis />
            <Chip label={formatDistance(language, track.estimate.distanceMeters)} emphasis />
            <Chip label={t(`difficulty_${track.difficulty}`)} />
            {track.minAge !== null ? <Chip label={t("ages", { min: track.minAge })} /> : null}
          </ChipRow>
          <ThemedText>{localized(track.description)}</ThemedText>
        </Stack>

        <Stack gap={1}>
          <ThemedText variant="label" tone="muted">
            {t("languages")}
          </ThemedText>
          <ChipRow>
            {track.languages.map((code) => (
              <Chip key={code} label={languageName(code, t)} />
            ))}
          </ChipRow>
        </Stack>

        <Card>
          <Stack gap={1}>
            <ThemedText variant="label">{t("safetyNotes")}</ThemedText>
            <ThemedText>{localized(track.safetyNotes)}</ThemedText>
          </Stack>
        </Card>

        {inPlay ? (
          <Button
            label={t("continueTrack")}
            variant="accent"
            onPress={() => router.push(`/t/${track.trackId}/play`)}
          />
        ) : (
          <Button
            label={t("start")}
            variant="accent"
            onPress={() => router.push(`/t/${track.trackId}/start`)}
          />
        )}
      </View>
    </Screen>
  );
}

function languageName(code: string, t: (key: StringKey) => string): string {
  if (code === "he") return t("language_he");
  if (code === "en") return t("language_en");
  return code;
}
