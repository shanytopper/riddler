import { router } from "expo-router";
import { Button } from "../src/components/Button.tsx";
import { Header } from "../src/components/Header.tsx";
import { Screen, Stack } from "../src/components/Screen.tsx";
import { ThemedText } from "../src/components/ThemedText.tsx";
import { useLanguage } from "../src/i18n/LanguageProvider.tsx";

export default function NotFoundRoute() {
  const { t } = useLanguage();
  return (
    <Screen>
      <Header />
      <Stack gap={2}>
        <ThemedText variant="heading">{t("notFound")}</ThemedText>
        <Button label={t("goHome")} variant="secondary" onPress={() => router.replace("/")} />
      </Stack>
    </Screen>
  );
}
