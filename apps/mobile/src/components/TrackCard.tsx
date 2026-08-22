import { router } from "expo-router";
import { Image, Pressable, View } from "react-native";
import type { TrackSummary } from "../delivery/types.ts";
import { useLanguage } from "../i18n/LanguageProvider.tsx";
import { formatDistance, formatDuration } from "../i18n/strings.ts";
import { useTheme } from "../theme/index.ts";
import { Chip, ChipRow } from "./Chip.tsx";
import { ThemedText } from "./ThemedText.tsx";

export function TrackCard({ track }: { track: TrackSummary }) {
  const { colors, radius, space } = useTheme();
  const { t, language, localized } = useLanguage();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/t/${track.trackId}`)}
      style={({ pressed }) => ({
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: "hidden",
        opacity: pressed ? 0.9 : 1,
      })}
    >
      {track.coverUrl ? (
        <Image
          source={{ uri: track.coverUrl }}
          style={{ width: "100%", height: 140 }}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
      ) : (
        <View style={{ height: 12, backgroundColor: colors.accent }} />
      )}
      <View style={{ padding: space(2), gap: space(1.5) }}>
        <ThemedText variant="heading">{localized(track.name)}</ThemedText>
        <ThemedText tone="muted" numberOfLines={3}>
          {localized(track.description)}
        </ThemedText>
        <ChipRow>
          <Chip label={formatDuration(language, track.estimate.durationMinutes)} />
          <Chip label={formatDistance(language, track.estimate.distanceMeters)} />
          <Chip label={t(`difficulty_${track.difficulty}`)} />
          {track.minAge !== null ? <Chip label={t("ages", { min: track.minAge })} /> : null}
        </ChipRow>
      </View>
    </Pressable>
  );
}
