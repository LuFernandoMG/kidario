import { useEffect, useState } from "react";
import * as ExpoLinking from "expo-linking";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { BootSplash } from "@/components/common/BootSplash";
import { resolveShellHrefFromDeepLink } from "@/lib/deepLinks";

export default function RootLayout() {
  const [isBootReady, setIsBootReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsBootReady(true);
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isBootReady) {
      return undefined;
    }

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
  }, [isBootReady, router]);

  if (!isBootReady) {
    return <BootSplash />;
  }

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
