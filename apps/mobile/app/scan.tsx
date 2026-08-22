import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button } from "../src/components/Button.tsx";
import { Header } from "../src/components/Header.tsx";
import { Screen, Stack } from "../src/components/Screen.tsx";
import { ThemedText } from "../src/components/ThemedText.tsx";
import { parseLink, type ParsedLink } from "../src/delivery/links.ts";
import { useLanguage } from "../src/i18n/LanguageProvider.tsx";
import { useTheme } from "../src/theme/index.ts";

function hrefFor(link: ParsedLink): string {
  switch (link.kind) {
    case "venue":
      return `/v/${link.slug}`;
    case "track":
      return `/t/${link.trackId}`;
    case "station":
      // Station codes open the track until the play screens exist (step 5).
      return `/t/${link.trackId}`;
  }
}

/** Reads a venue, track, or station QR code and routes to it (design.md §5.1, §8). */
export default function ScanRoute() {
  const { colors, radius, space } = useTheme();
  const { t } = useLanguage();
  const [permission, requestPermission] = useCameraPermissions();
  const [rejected, setRejected] = useState(false);
  const handled = useRef(false);

  const onScanned = ({ data }: BarcodeScanningResult) => {
    if (handled.current) return;
    const link = parseLink(data);
    if (!link) {
      setRejected(true);
      return;
    }
    handled.current = true;
    router.replace(hrefFor(link));
  };

  if (!permission?.granted) {
    return (
      <Screen>
        <Header />
        <Stack gap={2}>
          <ThemedText variant="heading">{t("scanVenueCode")}</ThemedText>
          <ThemedText tone="muted">
            {permission?.canAskAgain === false ? t("cameraDenied") : t("cameraPermission")}
          </ThemedText>
          {permission?.canAskAgain !== false ? (
            <Button label={t("grantCamera")} onPress={() => void requestPermission()} />
          ) : null}
        </Stack>
      </Screen>
    );
  }

  return (
    <Screen scroll={false} flush>
      <View style={{ paddingHorizontal: space(2) }}>
        <Header />
      </View>
      <View style={{ flex: 1, margin: space(2), borderRadius: radius.lg, overflow: "hidden" }}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={onScanned}
        />
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}
        >
          <View
            style={{
              width: 220,
              height: 220,
              borderRadius: radius.lg,
              borderWidth: 3,
              borderColor: rejected ? colors.danger : colors.accent,
            }}
          />
        </View>
      </View>
      <View style={{ paddingHorizontal: space(2), gap: space(1) }}>
        <ThemedText tone="muted" center>
          {rejected ? t("notAVenueCode") : t("scanInstruction")}
        </ThemedText>
      </View>
    </Screen>
  );
}
