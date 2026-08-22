import { Assistant_400Regular, Assistant_700Bold } from "@expo-google-fonts/assistant";
import { Heebo_400Regular, Heebo_700Bold } from "@expo-google-fonts/heebo";
import { Rubik_400Regular, Rubik_700Bold } from "@expo-google-fonts/rubik";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { LanguageProvider } from "../src/i18n/LanguageProvider.tsx";
import { PlayProvider } from "../src/play/PlayProvider.tsx";
import { RecentVenuesProvider } from "../src/state/RecentVenues.tsx";
import { ThemeProvider } from "../src/theme/index.ts";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  // The three typography pairings a tenant can choose from (design.md §6.1) ship with the app.
  const [fontsLoaded, fontError] = useFonts({
    Heebo_400Regular,
    Heebo_700Bold,
    Assistant_400Regular,
    Assistant_700Bold,
    Rubik_400Regular,
    Rubik_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) void SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <LanguageProvider>
      <ThemeProvider>
        <RecentVenuesProvider>
          <PlayProvider>
            <StatusBar style="auto" />
            <Stack screenOptions={{ headerShown: false }} />
          </PlayProvider>
        </RecentVenuesProvider>
      </ThemeProvider>
    </LanguageProvider>
  );
}
