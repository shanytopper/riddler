import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { Header } from "../../../src/components/Header.tsx";
import { Screen, Stack } from "../../../src/components/Screen.tsx";
import { ThemedText } from "../../../src/components/ThemedText.tsx";
import { delivery } from "../../../src/delivery/client.ts";
import {
  fetchLeaderboard,
  type LeaderboardEntry,
  type LeaderboardWindow,
} from "../../../src/delivery/leaderboard.ts";
import { useLanguage } from "../../../src/i18n/LanguageProvider.tsx";
import { formatPlayTime } from "../../../src/i18n/strings.ts";
import { usePlay } from "../../../src/play/PlayProvider.tsx";
import { ThemeProvider, useTheme } from "../../../src/theme/index.ts";
import type { ThemeInput } from "../../../src/theme/tokens.ts";

/** A track's leaderboard (design.md §5.3, §8): server-ranked, filterable by window, offline-aware. */
export default function LeaderboardRoute() {
  const { trackId } = useLocalSearchParams<{ trackId: string }>();
  const [theme, setTheme] = useState<ThemeInput | null>(null);

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

  return (
    <ThemeProvider theme={theme ?? undefined}>
      <LeaderboardScreen trackId={trackId ?? ""} />
    </ThemeProvider>
  );
}

function LeaderboardScreen({ trackId }: { trackId: string }) {
  const { colors, radius, space } = useTheme();
  const { t, language } = useLanguage();
  const { session } = usePlay();
  const [window, setWindow] = useState<LeaderboardWindow>("all");
  const [state, setState] = useState<
    { status: "loading" } | { status: "offline" } | { status: "ready"; entries: LeaderboardEntry[] }
  >({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    void fetchLeaderboard(trackId, window).then((entries) => {
      if (cancelled) return;
      setState(entries === null ? { status: "offline" } : { status: "ready", entries });
    });
    return () => {
      cancelled = true;
    };
  }, [trackId, window]);

  const myTeam = session?.bundle.trackId === trackId ? session.state.teamName : null;

  return (
    <Screen>
      <Header title={t("leaderboard")} />
      <Stack gap={2}>
        <View style={{ flexDirection: "row", gap: space(1) }}>
          {(["all", "today"] as const).map((option) => (
            <Pressable
              key={option}
              accessibilityRole="button"
              accessibilityState={{ selected: option === window }}
              onPress={() => setWindow(option)}
              style={{
                paddingVertical: space(1),
                paddingHorizontal: space(2),
                borderRadius: 999,
                borderWidth: 1,
                borderColor: option === window ? colors.primary : colors.border,
                backgroundColor: option === window ? colors.surfaceAlt : colors.background,
              }}
            >
              <ThemedText variant="label" tone={option === window ? "primary" : "muted"}>
                {t(option === "all" ? "leaderboardAll" : "leaderboardToday")}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        {state.status === "loading" ? <ThemedText tone="muted">{t("loading")}</ThemedText> : null}
        {state.status === "offline" ? (
          <ThemedText tone="muted">{t("leaderboardOffline")}</ThemedText>
        ) : null}
        {state.status === "ready" && state.entries.length === 0 ? (
          <ThemedText tone="muted">{t("leaderboardEmpty")}</ThemedText>
        ) : null}
        {state.status === "ready"
          ? state.entries.map((entry) => {
              const mine = myTeam !== null && entry.teamName === myTeam;
              return (
                <View
                  key={`${entry.rank}-${entry.teamName}`}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: space(1.5),
                    padding: space(1.5),
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: mine ? colors.accent : colors.border,
                    backgroundColor: mine ? colors.surfaceAlt : colors.surface,
                  }}
                >
                  <ThemedText variant="label" tone="muted" style={{ minWidth: 44 }}>
                    {t("rank", { n: entry.rank })}
                  </ThemedText>
                  <ThemedText style={{ flex: 1 }} numberOfLines={1}>
                    {entry.teamName}
                    {mine ? ` · ${t("you")}` : ""}
                  </ThemedText>
                  <ThemedText variant="label" tone="muted">
                    {formatPlayTime(entry.playTimeMs)}
                  </ThemedText>
                  <ThemedText variant="label">{entry.score}</ThemedText>
                </View>
              );
            })
          : null}
      </Stack>
    </Screen>
  );
}
