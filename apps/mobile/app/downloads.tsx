import { useState } from "react";
import { Alert, View } from "react-native";
import type { LocalizedString } from "../src/i18n/strings.ts";
import { deleteInstalledBundle } from "../src/bundles/bundleStore.ts";
import { listBundles, type BundleRow } from "../src/db/bundleRepo.ts";
import { resumableSessionsForBundle } from "../src/db/sessionRepo.ts";
import { Button } from "../src/components/Button.tsx";
import { Header } from "../src/components/Header.tsx";
import { Screen, Stack } from "../src/components/Screen.tsx";
import { ThemedText } from "../src/components/ThemedText.tsx";
import { useLanguage } from "../src/i18n/LanguageProvider.tsx";
import { usePlay } from "../src/play/PlayProvider.tsx";
import { useTheme } from "../src/theme/index.ts";

/** The downloaded-bundle cache (design.md §8): list and delete, freeing storage from Settings. */
export default function DownloadsRoute() {
  const { t } = useLanguage();
  const play = usePlay();
  const [bundles, setBundles] = useState<BundleRow[]>(() => listBundles());

  const remove = (bundle: BundleRow) => {
    const inProgress = resumableSessionsForBundle(bundle.trackId, bundle.version) > 0;
    const message = inProgress
      ? `${t("deleteDownloadConfirm")}\n\n${t("deleteWhilePlaying")}`
      : t("deleteDownloadConfirm");
    Alert.alert(t("deleteDownload"), message, [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("deleteDownload"),
        style: "destructive",
        onPress: () => {
          // End the live session first if it's this track, so no screen points at missing files.
          const current = play.session;
          if (
            current?.bundle.trackId === bundle.trackId &&
            current.bundle.version === bundle.version
          ) {
            play.leave();
            play.clear();
          }
          deleteInstalledBundle(bundle.trackId, bundle.version);
          setBundles(listBundles());
        },
      },
    ]);
  };

  return (
    <Screen>
      <Header title={t("downloads")} />
      {bundles.length === 0 ? (
        <ThemedText tone="muted">{t("noDownloads")}</ThemedText>
      ) : (
        <Stack gap={1.5}>
          {bundles.map((bundle) => (
            <DownloadCard
              key={`${bundle.trackId}-${bundle.version}`}
              bundle={bundle}
              onDelete={() => remove(bundle)}
            />
          ))}
        </Stack>
      )}
    </Screen>
  );
}

function DownloadCard({ bundle, onDelete }: { bundle: BundleRow; onDelete: () => void }) {
  const { colors, radius, space } = useTheme();
  const { t, localized } = useLanguage();
  const name = safeName(bundle.trackName);
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.md,
        padding: space(2),
        gap: space(1),
      }}
    >
      <ThemedText variant="label">{localized(name)}</ThemedText>
      <ThemedText variant="caption" tone="muted">
        {formatMb(bundle.totalBytes)} · {t("trackVersion", { n: bundle.version })}
      </ThemedText>
      <View style={{ alignSelf: "flex-start", marginTop: space(0.5) }}>
        <Button label={t("deleteDownload")} variant="ghost" onPress={onDelete} />
      </View>
    </View>
  );
}

function formatMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** The stored track name is a JSON LocalizedString; fall back to the raw text if it isn't. */
function safeName(stored: string): LocalizedString {
  try {
    const parsed = JSON.parse(stored) as unknown;
    if (parsed && typeof parsed === "object") return parsed as LocalizedString;
  } catch {
    // not JSON
  }
  return { en: stored } as LocalizedString;
}
