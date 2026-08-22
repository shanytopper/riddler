import type { Tenant } from "@riddles/bundle-schema";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { Button } from "../../src/components/Button.tsx";
import { Header } from "../../src/components/Header.tsx";
import { LinkRow } from "../../src/components/LinkRow.tsx";
import { Screen, Stack } from "../../src/components/Screen.tsx";
import { ThemedText } from "../../src/components/ThemedText.tsx";
import { TrackCard } from "../../src/components/TrackCard.tsx";
import { VenueHeader } from "../../src/components/VenueHeader.tsx";
import { delivery } from "../../src/delivery/client.ts";
import type { TrackSummary } from "../../src/delivery/types.ts";
import { useLanguage } from "../../src/i18n/LanguageProvider.tsx";
import { useRecentVenues } from "../../src/state/RecentVenues.tsx";
import { ThemeProvider, useTheme } from "../../src/theme/index.ts";
import { emergencyNumbers } from "../../src/util/emergency.ts";

type Loaded =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "ready"; tenant: Tenant; tracks: TrackSummary[] };

/** The venue home (design.md §5.1): everything below the header is in the operator's theme. */
export default function VenueRoute() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [state, setState] = useState<Loaded>({ status: "loading" });
  const { remember } = useRecentVenues();

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    void (async () => {
      const tenant = slug ? await delivery.getTenant(slug) : null;
      if (!tenant) {
        if (!cancelled) setState({ status: "missing" });
        return;
      }
      const tracks = await delivery.listTracks(tenant.tenantId);
      if (cancelled) return;
      setState({ status: "ready", tenant, tracks });
      remember({
        tenantId: tenant.tenantId,
        slug: tenant.slug,
        displayName: tenant.displayName,
        coverUrl: tenant.theme.coverUrl,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, remember]);

  if (state.status === "loading") return <Placeholder messageKey="loading" />;
  if (state.status === "missing") return <Placeholder messageKey="venueNotFound" />;
  return (
    <ThemeProvider theme={state.tenant.theme}>
      <VenueHome tenant={state.tenant} tracks={state.tracks} />
    </ThemeProvider>
  );
}

function Placeholder({ messageKey }: { messageKey: "loading" | "venueNotFound" }) {
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

function VenueHome({ tenant, tracks }: { tenant: Tenant; tracks: TrackSummary[] }) {
  const { space } = useTheme();
  const { t, localized } = useLanguage();
  const { support, emergency } = tenant.contacts;
  return (
    <Screen flush>
      <VenueHeader tenant={tenant} subtitle={localized(tenant.about)} />
      <View style={{ paddingHorizontal: space(2), paddingTop: space(3), gap: space(4) }}>
        <Stack gap={1.5}>
          <ThemedText variant="heading">{t("tracks")}</ThemedText>
          {tracks.length === 0 ? (
            <ThemedText tone="muted">{t("noTracks")}</ThemedText>
          ) : (
            tracks.map((track) => <TrackCard key={track.trackId} track={track} />)
          )}
        </Stack>

        <Stack gap={0}>
          <ThemedText variant="heading" style={{ marginBottom: space(1) }}>
            {t("support")}
          </ThemedText>
          {support.phone ? (
            <LinkRow label={t("phone")} detail={support.phone} href={`tel:${support.phone}`} />
          ) : null}
          {support.email ? (
            <LinkRow label={t("email")} detail={support.email} href={`mailto:${support.email}`} />
          ) : null}
          {support.url ? (
            <LinkRow label={t("support")} detail={support.url} href={support.url} />
          ) : null}
          {tenant.websiteUrl ? <LinkRow label={t("website")} href={tenant.websiteUrl} /> : null}
          <LinkRow label={t("privacy")} href={tenant.legal.privacyUrl} />
          <LinkRow label={t("terms")} href={tenant.legal.termsUrl} />
        </Stack>

        <Stack gap={0}>
          <ThemedText variant="heading" style={{ marginBottom: space(1) }}>
            {t("emergency")}
          </ThemedText>
          {emergency.phone ? (
            <LinkRow
              label={localized(tenant.displayName)}
              detail={emergency.phone}
              href={`tel:${emergency.phone}`}
            />
          ) : null}
          {emergencyNumbers(tenant.countryCode).map((entry) => (
            <LinkRow
              key={entry.number}
              label={t(entry.label)}
              detail={entry.number}
              href={`tel:${entry.number}`}
            />
          ))}
          {emergency.note ? (
            <ThemedText variant="caption" tone="muted" style={{ marginTop: space(1.5) }}>
              {localized(emergency.note)}
            </ThemedText>
          ) : null}
        </Stack>
      </View>
    </Screen>
  );
}
