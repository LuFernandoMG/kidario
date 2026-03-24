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
  extra: {
    appEnv: process.env.EXPO_PUBLIC_APP_ENV ?? "development",
  },
};

export default config;
