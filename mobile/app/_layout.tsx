import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { BootSplash } from "@/components/common/BootSplash";

export default function RootLayout() {
  const [isBootReady, setIsBootReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsBootReady(true);
    }, 500);

    return () => clearTimeout(timer);
  }, []);

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
