import type { TrackContent } from "@riddles/bundle-schema";
import {
  BASEMAP_ASSETS_BASE_URL,
  FLAVOR_FOR_SCHEME,
  glyphsUrlTemplate,
  spriteUrl,
} from "@riddles/bundle-schema/map-assets";
import { useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import springTrail from "../../../../content/ein-dror/tracks/spring-trail/content.json";
import { Header } from "../../src/components/Header.tsx";
import { Screen } from "../../src/components/Screen.tsx";
import { ThemedText } from "../../src/components/ThemedText.tsx";
import { useLanguage } from "../../src/i18n/LanguageProvider.tsx";
import { usePosition } from "../../src/location/usePosition.ts";
import { bearingDegrees, distanceMeters, roundDistance } from "../../src/map/geo.ts";
import { resolveMapSource, type ResolvedMapSource } from "../../src/map/sources.ts";
// No extension: Metro picks TrackMap.web.tsx on web and TrackMap.tsx on native only for extensionless imports.
import { TrackMap } from "../../src/map/TrackMap";
import type { StationMarker } from "../../src/map/types.ts";
import { useTheme } from "../../src/theme/index.ts";

const content = springTrail as unknown as TrackContent;
const leg = content.legs[0];
const tilesMap = leg.map.kind === "tiles" ? leg.map : null;

/**
 * Step 4 spike screen (design.md §12.1): the Spring Trail's map from the offline extract when it is
 * on the device, with live position and the distance to the current station. Not linked from the
 * app; open /dev/map directly.
 */
export default function MapSpikeRoute() {
  const { colors, scheme, space } = useTheme();
  const { localized } = useLanguage();
  const [resolved, setResolved] = useState<ResolvedMapSource | null>(null);
  const [ready, setReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  // Diagnostic: swap only fonts and sprites to the public host while tiles stay local.
  const [remoteAssets, setRemoteAssets] = useState(false);
  const { position, permission, error: positionError } = usePosition(true);

  const effectiveSource = useMemo(() => {
    if (!resolved || !remoteAssets) return resolved?.source ?? null;
    return {
      ...resolved.source,
      glyphsUrl: glyphsUrlTemplate(BASEMAP_ASSETS_BASE_URL),
      spriteUrl: spriteUrl(BASEMAP_ASSETS_BASE_URL, FLAVOR_FOR_SCHEME[scheme], true),
    };
  }, [resolved, remoteAssets, scheme]);

  useEffect(() => {
    let cancelled = false;
    void resolveMapSource({ legId: leg.id, languages: content.languages, scheme }).then(
      (result) => {
        if (!cancelled) setResolved(result);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [scheme]);

  const stations = useMemo<StationMarker[]>(
    () =>
      leg.stations.map((station, index) => ({
        id: station.id,
        lng: station.location?.lng ?? 0,
        lat: station.location?.lat ?? 0,
        label: String(index + 1),
        state: index < currentIndex ? "done" : index === currentIndex ? "current" : "upcoming",
      })),
    [currentIndex],
  );

  const current = leg.stations[currentIndex];
  const distance =
    position && current?.location ? distanceMeters(position, current.location) : null;
  const bearing =
    position && current?.location ? Math.round(bearingDegrees(position, current.location)) : null;

  return (
    <Screen scroll={false} flush>
      <View style={{ paddingHorizontal: space(2) }}>
        <Header title={`${localized(content.name)} · map spike`} />
      </View>
      {tilesMap && effectiveSource ? (
        <TrackMap
          bounds={tilesMap.bounds}
          minZoom={tilesMap.minZoom}
          maxZoom={tilesMap.maxZoom}
          stations={stations}
          position={position}
          source={effectiveSource}
          onStationPress={(id) => {
            const index = leg.stations.findIndex((station) => station.id === id);
            if (index >= 0) setCurrentIndex(index);
          }}
          onReady={() => setReady(true)}
          onError={setMapError}
        />
      ) : (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ThemedText tone="muted">
            {tilesMap ? "resolving map source…" : "this leg has no tiles map"}
          </ThemedText>
        </View>
      )}
      <View
        style={{
          paddingHorizontal: space(2),
          paddingVertical: space(1.5),
          gap: 2,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
      >
        <Line
          label="tiles"
          value={
            resolved
              ? `${resolved.source.offline ? "offline" : "remote"} · ${resolved.source.tilesUrl}`
              : "…"
          }
        />
        {resolved?.note ? <Line label="note" value={resolved.note} /> : null}
        <Line
          label="map"
          value={mapError ? `error: ${mapError}` : ready ? "rendered" : "loading…"}
        />
        <Line
          label="position"
          value={
            position
              ? `${position.lat.toFixed(5)}, ${position.lng.toFixed(5)} ±${Math.round(position.accuracy ?? 0)} m`
              : permission === "denied"
                ? "permission denied"
                : (positionError ?? "waiting for a fix…")
          }
        />
        <Line
          label={`to station ${currentIndex + 1}`}
          value={distance !== null ? `${roundDistance(distance)} m · bearing ${bearing}°` : "—"}
        />
        <Pressable
          accessibilityRole="button"
          onPress={() => setRemoteAssets((value) => !value)}
          style={{ paddingVertical: space(1) }}
        >
          <ThemedText variant="caption" tone="primary">
            fonts & sprites: {remoteAssets ? "remote host" : "local files"} · tap to switch
          </ThemedText>
        </Pressable>
      </View>
    </Screen>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <ThemedText variant="caption" numberOfLines={2}>
      <ThemedText variant="caption" tone="muted">
        {label}:{" "}
      </ThemedText>
      {value}
    </ThemedText>
  );
}
