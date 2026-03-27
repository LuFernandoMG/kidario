import { useEffect } from "react";
import * as ExpoLinking from "expo-linking";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { resolveShellHrefFromDeepLink } from "@/lib/deepLinks";

export default function RootLayout() {
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    const navigateFromUrl = (url: string, replace = false) => {
      const href = resolveShellHrefFromDeepLink(url);
      if (!href) {
        return;
      }

      if (replace) {
        router.replace(href);
      } else {
        router.push(href);
      }
    };

    void ExpoLinking.getInitialURL().then((url) => {
      if (isMounted && url) {
        navigateFromUrl(url, true);
      }
    });

    const subscription = ExpoLinking.addEventListener("url", ({ url }) => {
      navigateFromUrl(url);
    });

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, [router]);

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      />
    </>
  );
}
