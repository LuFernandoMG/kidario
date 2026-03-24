import { useEffect, useRef, useState } from "react";
import NetInfo from "@react-native-community/netinfo";

export type NetworkStatus = "online" | "offline" | "reconnecting";

export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>("online");
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const isOnline = Boolean(state.isConnected) && state.isInternetReachable !== false;

      setStatus((current) => {
        if (!isOnline) {
          if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
          }
          return "offline";
        }

        if (current === "offline") {
          if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current);
          }

          reconnectTimerRef.current = setTimeout(() => {
            setStatus("online");
            reconnectTimerRef.current = null;
          }, 2000);

          return "reconnecting";
        }

        return current === "reconnecting" ? current : "online";
      });
    });

    return () => {
      unsubscribe();
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
    };
  }, []);

  return status;
}
