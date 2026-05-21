import type { ExpoConfig } from "expo/config";

const appName = "Kidario Mobile";
const slug = "kidario-mobile";
const scheme = "kidario-mobile";

const config: ExpoConfig = {
  name: appName,
  slug,
  scheme,
  version: "1.0.0",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  plugins: ["expo-router", "expo-document-picker"],
  experiments: {
    typedRoutes: true,
  },
  web: {
    bundler: "metro",
  },
  ios: {
    bundleIdentifier: "com.leikvir.kidario",
  },
  extra: {
    appEnv: process.env.EXPO_PUBLIC_APP_ENV ?? "development",
    eas: {
      projectId: "3c4e45d3-e92a-4c86-87c9-012e68e5e7da",
    },
  },
};

export default config;
