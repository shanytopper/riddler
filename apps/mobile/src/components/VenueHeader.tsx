import type { Tenant } from "@riddles/bundle-schema";
import { Image, View } from "react-native";
import { useLanguage } from "../i18n/LanguageProvider.tsx";
import { useTheme } from "../theme/index.ts";
import { Header } from "./Header.tsx";
import { ThemedText } from "./ThemedText.tsx";

/** The branded band at the top of a venue: cover or primary color, logo or monogram, name. */
export function VenueHeader({ tenant, subtitle }: { tenant: Tenant; subtitle?: string }) {
  const { colors, radius, space } = useTheme();
  const { localized } = useLanguage();
  const name = localized(tenant.displayName);
  const logo = tenant.theme.background === "dark" ? tenant.theme.logoDarkUrl : tenant.theme.logoUrl;
  return (
    <View style={{ backgroundColor: colors.primary }}>
      {tenant.theme.coverUrl ? (
        <Image
          source={{ uri: tenant.theme.coverUrl }}
          style={{ width: "100%", height: 160 }}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
      ) : null}
      <View style={{ paddingHorizontal: space(2), paddingBottom: space(3) }}>
        <Header onPrimary />
        <View style={{ flexDirection: "row", alignItems: "center", gap: space(2) }}>
          {logo ? (
            <Image
              source={{ uri: logo }}
              style={{ width: 56, height: 56, borderRadius: radius.md }}
              resizeMode="contain"
              accessibilityLabel={name}
            />
          ) : (
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: radius.md,
                backgroundColor: colors.accent,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ThemedText variant="title" tone="onAccent" style={{ lineHeight: 32 }}>
                {name.trim().charAt(0).toUpperCase()}
              </ThemedText>
            </View>
          )}
          <View style={{ flex: 1, gap: space(0.5) }}>
            <ThemedText variant="title" tone="onPrimary">
              {name}
            </ThemedText>
            {subtitle ? (
              <ThemedText variant="caption" tone="onPrimary" style={{ opacity: 0.85 }}>
                {subtitle}
              </ThemedText>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}
