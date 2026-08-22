import type { ConfigContext, ExpoConfig } from "expo/config";

// Dedicated operator builds (design.md §9.3) pin one tenant and take their store identity from the
// environment at build time. The umbrella app leaves all of these unset.
const pinnedTenant = process.env.RIDDLES_TENANT_SLUG ?? null;

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: process.env.RIDDLES_APP_NAME ?? "Riddles",
  slug: "riddles",
  version: "0.1.0",
  scheme: process.env.RIDDLES_SCHEME ?? "riddles",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  icon: "./assets/icon.png",
  ios: {
    bundleIdentifier: process.env.RIDDLES_IOS_BUNDLE_ID ?? "app.riddles.mobile",
    supportsTablet: false,
  },
  android: {
    package: process.env.RIDDLES_ANDROID_PACKAGE ?? "app.riddles.mobile",
    adaptiveIcon: {
      backgroundColor: "#2F3E46",
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    bundler: "metro",
    output: "single",
    favicon: "./assets/favicon.png",
  },
  plugins: [
    "expo-router",
    [
      "expo-splash-screen",
      { backgroundColor: "#2F3E46", image: "./assets/splash-icon.png", imageWidth: 200 },
    ],
    [
      "expo-camera",
      {
        cameraPermission: "The camera is used only to read venue and station QR codes.",
        recordAudioAndroid: false,
      },
    ],
    ["expo-localization", { supportedLocales: { ios: ["en", "he"], android: ["en", "he"] } }],
    [
      "expo-location",
      {
        locationWhenInUsePermission:
          "Your position is shown on the venue map and used to check that you have reached a station.",
        isAndroidBackgroundLocationEnabled: false,
      },
    ],
    // MapLibre Native 13.5 rather than the binding's 13.2 default: 13.2 has an open crash in the
    // PMTiles file source (maplibre-native #4459).
    ["@maplibre/maplibre-react-native", { android: { nativeVersion: "13.5.0" } }],
    "./plugins/withShortNativeBuildDir",
  ],
  // `extra` is deep-merged by Expo and a null value comes out as {}, so the key is omitted when unset.
  extra: pinnedTenant ? { pinnedTenant } : {},
});
