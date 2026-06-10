import type { ExpoConfig } from "expo/config";

const appName = "Kidario";
const slug = "kidario-mobile";
const scheme = "kidario-mobile";
const androidPackage = "com.leikvir.kidario";
const brandBackgroundColor = "#F7F4EF";
const brandPrimaryColor = "#0F766E";

const config: ExpoConfig = {
  name: appName,
  slug,
  scheme,
  version: "1.0.0",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  icon: "./assets/icon.png",
  backgroundColor: brandBackgroundColor,
  primaryColor: brandPrimaryColor,
  plugins: ["expo-router", "expo-document-picker"],
  experiments: {
    typedRoutes: true,
  },
  splash: {
    image: "./assets/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: brandBackgroundColor,
  },
  web: {
    bundler: "metro",
  },
  ios: {
    bundleIdentifier: "com.leikvir.kidario",
  },
  android: {
    package: androidPackage,
    icon: "./assets/icon.png",
    backgroundColor: brandBackgroundColor,
    userInterfaceStyle: "automatic",
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: brandBackgroundColor,
    },
    permissions: [],
    allowBackup: false,
    softwareKeyboardLayoutMode: "resize",
    predictiveBackGestureEnabled: false,
    intentFilters: [
      {
        action: "VIEW",
        category: ["BROWSABLE", "DEFAULT"],
        data: [
          {
            scheme,
          },
        ],
      },
    ],
  },
  extra: {
    appEnv: process.env.EXPO_PUBLIC_APP_ENV ?? "development",
    androidPackage,
    eas: {
      projectId: "3c4e45d3-e92a-4c86-87c9-012e68e5e7da",
    },
  },
};

export default config;
