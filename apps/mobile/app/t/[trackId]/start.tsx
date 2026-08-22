import type { BundleManifest, Tenant } from "@riddles/bundle-schema";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import {
  installBundle,
  isInstalled,
  loadInstalled,
  schemaSupport,
} from "../../../src/bundles/bundleStore.ts";
import { Button } from "../../../src/components/Button.tsx";
import { Card } from "../../../src/components/Card.tsx";
import { Chip, ChipRow } from "../../../src/components/Chip.tsx";
import { Header } from "../../../src/components/Header.tsx";
import { Screen, Stack } from "../../../src/components/Screen.tsx";
import { ThemedText } from "../../../src/components/ThemedText.tsx";
import { delivery } from "../../../src/delivery/client.ts";
import type { BundleRelease, TrackSummary } from "../../../src/delivery/types.ts";
import { useLanguage } from "../../../src/i18n/LanguageProvider.tsx";
import { UI_LANGUAGES, type UiLanguage } from "../../../src/i18n/strings.ts";
import { usePlay } from "../../../src/play/PlayProvider.tsx";
import { TEAM_NAME_SUGGESTIONS, validateTeamName } from "../../../src/play/teamNames.ts";
import { ThemeProvider, useTheme } from "../../../src/theme/index.ts";

type Loaded =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "ready"; tenant: Tenant; track: TrackSummary; release: BundleRelease | null };

/** The start flow (design.md §5.2): language → team name → safety notes → download → play. */
export default function StartRoute() {
  const { trackId } = useLocalSearchParams<{ trackId: string }>();
  const [state, setState] = useState<Loaded>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const found = trackId ? await delivery.getTrack(trackId) : null;
      if (!found) {
        if (!cancelled) setState({ status: "missing" });
        return;
      }
      const release = await delivery.getBundle(trackId!);
      if (!cancelled) setState({ status: "ready", ...found, release });
    })();
    return () => {
      cancelled = true;
    };
  }, [trackId]);

  const { t } = useLanguage();
  if (state.status !== "ready") {
    return (
      <Screen>
        <Header />
        <ThemedText tone="muted">
          {t(state.status === "loading" ? "loading" : "trackNotFound")}
        </ThemedText>
      </Screen>
    );
  }
  return (
    <ThemeProvider theme={state.tenant.theme}>
      <StartFlow tenant={state.tenant} track={state.track} release={state.release} />
    </ThemeProvider>
  );
}

type Step = "language" | "team" | "safety" | "download";

function StartFlow({
  tenant,
  track,
  release,
}: {
  tenant: Tenant;
  track: TrackSummary;
  release: BundleRelease | null;
}) {
  const { colors, fonts, radius, space } = useTheme();
  const { t, language: uiLanguage, setLanguage, localized } = useLanguage();
  const play = usePlay();
  const available = UI_LANGUAGES.filter((code) => track.languages.includes(code));
  const [step, setStep] = useState<Step>("language");
  const [language, setPlayLanguage] = useState<UiLanguage>(
    available.includes(uiLanguage) ? uiLanguage : (available[0] ?? "en"),
  );
  const [teamName, setTeamName] = useState("");
  const [nameVerdict, setNameVerdict] = useState<"ok" | "length" | "blocked" | null>(null);
  const [progress, setProgress] = useState<{
    phase: "download" | "verify" | "unpack";
    fraction: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const chooseLanguage = (code: UiLanguage) => {
    setPlayLanguage(code);
    setLanguage(code);
  };

  const confirmTeam = () => {
    const verdict = validateTeamName(teamName);
    setNameVerdict(verdict);
    if (verdict === "ok") setStep("safety");
  };

  const begin = async () => {
    setError(null);
    try {
      // Refuse a bundle whose schema this app version doesn't understand (design.md §8).
      if (release) {
        const support = schemaSupport(release.manifest.schemaVersion);
        if (support !== "ok")
          throw new Error(t(support === "app_outdated" ? "appOutdated" : "bundleUnsupported"));
      }
      let bundle =
        release && isInstalled(track.trackId, release.manifest.trackVersion)
          ? await loadInstalled(track.trackId, release.manifest.trackVersion)
          : null;
      if (!bundle) {
        if (!release) throw new Error(t("downloadFailed"));
        bundle = await installBundle({
          zipUrl: release.zipUrl,
          manifest: release.manifest,
          onProgress: (phase, fraction) => setProgress({ phase, fraction }),
        });
      }
      play.start(bundle, { language, teamName: teamName.trim() });
      router.replace(`/t/${track.trackId}/play`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setProgress(null);
    }
  };

  useEffect(() => {
    if (step === "download" && progress === null && error === null) void begin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  return (
    <Screen flush>
      <View style={{ backgroundColor: colors.primary, paddingHorizontal: space(2) }}>
        <Header fallbackHref={`/t/${track.trackId}`} title={localized(track.name)} onPrimary />
      </View>
      <View style={{ paddingHorizontal: space(2), paddingTop: space(3), gap: space(3) }}>
        {step === "language" ? (
          <Stack gap={2}>
            <ThemedText variant="title">{t("chooseLanguage")}</ThemedText>
            <View style={{ gap: space(1) }}>
              {available.map((code) => (
                <Pressable
                  key={code}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: code === language }}
                  onPress={() => chooseLanguage(code)}
                  style={{
                    padding: space(2),
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: code === language ? colors.primary : colors.border,
                    backgroundColor: code === language ? colors.surfaceAlt : colors.background,
                  }}
                >
                  <ThemedText variant="heading">{t(`language_${code}`)}</ThemedText>
                </Pressable>
              ))}
            </View>
            <Button label={t("continue")} variant="accent" onPress={() => setStep("team")} />
          </Stack>
        ) : null}

        {step === "team" ? (
          <Stack gap={2}>
            <ThemedText variant="title">{t("teamName")}</ThemedText>
            <ThemedText tone="muted">{t("teamNameHint")}</ThemedText>
            <TextInput
              value={teamName}
              onChangeText={(text) => {
                setTeamName(text);
                setNameVerdict(null);
              }}
              onSubmitEditing={confirmTeam}
              placeholder={t("teamNamePlaceholder")}
              placeholderTextColor={colors.textMuted}
              maxLength={24}
              returnKeyType="done"
              accessibilityLabel={t("teamName")}
              style={{
                minHeight: 52,
                borderWidth: 1,
                borderColor: nameVerdict && nameVerdict !== "ok" ? colors.danger : colors.border,
                borderRadius: radius.md,
                paddingHorizontal: space(1.5),
                color: colors.text,
                backgroundColor: colors.background,
                fontSize: 18,
                fontFamily: fonts.regular,
              }}
            />
            {nameVerdict === "length" ? (
              <ThemedText variant="caption" tone="danger">
                {t("teamNameInvalid")}
              </ThemedText>
            ) : null}
            {nameVerdict === "blocked" ? (
              <ThemedText variant="caption" tone="danger">
                {t("teamNameBlocked")}
              </ThemedText>
            ) : null}
            <ThemedText variant="label" tone="muted">
              {t("ideas")}
            </ThemedText>
            <ChipRow>
              {TEAM_NAME_SUGGESTIONS[language].map((name) => (
                <Pressable key={name} accessibilityRole="button" onPress={() => setTeamName(name)}>
                  <Chip label={name} />
                </Pressable>
              ))}
            </ChipRow>
            <Button
              label={t("continue")}
              variant="accent"
              onPress={confirmTeam}
              disabled={!teamName.trim()}
            />
          </Stack>
        ) : null}

        {step === "safety" ? (
          <Stack gap={2}>
            <ThemedText variant="title">{t("safetyNotes")}</ThemedText>
            <Card>
              <ThemedText>{localized(track.safetyNotes)}</ThemedText>
            </Card>
            <ThemedText variant="caption" tone="muted">
              {t("downloadNeedsNetwork")}
            </ThemedText>
            <Button
              label={t("safetyAcknowledge")}
              variant="accent"
              onPress={() => setStep("download")}
            />
          </Stack>
        ) : null}

        {step === "download" ? (
          <Stack gap={2}>
            <ThemedText variant="title">
              {error ??
                (progress?.phase === "download" || !progress ? t("downloading") : t("verifying"))}
            </ThemedText>
            {release && !error ? (
              <ThemedText tone="muted">
                {(release.manifest.totalBytes / (1024 * 1024)).toFixed(1)} MB
              </ThemedText>
            ) : null}
            {!error ? <ProgressBar fraction={progress ? phaseFraction(progress) : 0} /> : null}
            {error ? (
              <Button
                label={t("retry")}
                variant="accent"
                onPress={() => {
                  setError(null);
                  setProgress(null);
                  void begin();
                }}
              />
            ) : null}
          </Stack>
        ) : null}
      </View>
    </Screen>
  );
}

/** Download is most of the wait; verification and unpacking share the rest. */
function phaseFraction(progress: {
  phase: "download" | "verify" | "unpack";
  fraction: number;
}): number {
  if (progress.phase === "download") return progress.fraction * 0.8;
  if (progress.phase === "verify") return 0.8 + progress.fraction * 0.1;
  return 0.9 + progress.fraction * 0.1;
}

function ProgressBar({ fraction }: { fraction: number }) {
  const { colors, radius } = useTheme();
  return (
    <View
      style={{
        height: 10,
        borderRadius: radius.sm,
        backgroundColor: colors.surfaceAlt,
        overflow: "hidden",
      }}
      accessibilityRole="progressbar"
    >
      <View
        style={{
          width: `${Math.round(Math.min(1, Math.max(0, fraction)) * 100)}%`,
          height: "100%",
          backgroundColor: colors.accent,
        }}
      />
    </View>
  );
}

export type { BundleManifest };
