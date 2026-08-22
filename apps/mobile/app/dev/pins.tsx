import type { TrackContent } from "@riddles/bundle-schema";
import { useState } from "react";
import { Pressable, Share, View } from "react-native";
import springTrail from "../../../../content/ein-dror/tracks/spring-trail/content.json";
import { Button } from "../../src/components/Button.tsx";
import { Header } from "../../src/components/Header.tsx";
import { Screen, Stack } from "../../src/components/Screen.tsx";
import { ThemedText } from "../../src/components/ThemedText.tsx";
import { useLanguage } from "../../src/i18n/LanguageProvider.tsx";
import { usePosition } from "../../src/location/usePosition.ts";
import { useTheme } from "../../src/theme/index.ts";

const content = springTrail as unknown as TrackContent;

/**
 * Dev-only pin capture (roadmap step 5.5): walk the real venue, stand at each station, tap to take
 * the current GPS fix, then share the coordinates as JSON to paste into content.json.
 */
export default function PinCaptureRoute() {
  const { colors, radius, space } = useTheme();
  const { t, localized } = useLanguage();
  const { position } = usePosition(true);
  const leg = content.legs[0];
  const [pins, setPins] = useState<Record<string, { lat: number; lng: number }>>(() =>
    Object.fromEntries(
      leg.stations.map((station) => [station.id, station.location ?? { lat: 0, lng: 0 }]),
    ),
  );

  const exportJson = () => {
    const payload = leg.stations.map((station) => ({
      id: station.id,
      title: station.title.en,
      location: {
        lat: Number(pins[station.id]!.lat.toFixed(6)),
        lng: Number(pins[station.id]!.lng.toFixed(6)),
      },
    }));
    void Share.share({ message: JSON.stringify(payload, null, 2) });
  };

  return (
    <Screen>
      <Header title="pin capture" />
      <Stack gap={2}>
        <ThemedText variant="caption" tone="muted">
          {position
            ? `${position.lat.toFixed(5)}, ${position.lng.toFixed(5)} ±${Math.round(position.accuracy ?? 0)} m`
            : "…"}
        </ThemedText>
        {leg.stations.map((station, index) => {
          const pin = pins[station.id]!;
          const moved = pin.lat !== station.location?.lat || pin.lng !== station.location?.lng;
          return (
            <View
              key={station.id}
              style={{
                padding: space(1.5),
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: moved ? colors.accent : colors.border,
                gap: space(1),
              }}
            >
              <ThemedText variant="label">
                {index + 1}. {localized(station.title)}
              </ThemedText>
              <ThemedText variant="caption" tone="muted">
                {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}
              </ThemedText>
              <Pressable
                accessibilityRole="button"
                disabled={!position}
                onPress={() =>
                  position &&
                  setPins((all) => ({
                    ...all,
                    [station.id]: { lat: position.lat, lng: position.lng },
                  }))
                }
                style={{ alignSelf: "flex-start", opacity: position ? 1 : 0.5 }}
              >
                <ThemedText tone="primary">{t("captureHere")}</ThemedText>
              </Pressable>
            </View>
          );
        })}
        <Button label={t("exportPins")} variant="accent" onPress={exportJson} />
      </Stack>
    </Screen>
  );
}
