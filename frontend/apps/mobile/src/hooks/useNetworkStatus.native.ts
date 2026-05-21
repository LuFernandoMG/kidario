import { useEffect, useRef, useState } from "react";
import NetInfo from "@react-native-community/netinfo";

import { resolveNetworkStatusTransition, type NetworkStatus } from "@kidario/shared/mobile/networkStatus";

export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>("online");
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const isOnline = Boolean(state.isConnected) && state.isInternetReachable !== false;

      setStatus((current) => {
        const nextStatus = resolveNetworkStatusTransition(current, isOnline);

        if (nextStatus === "offline") {
          if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
          }
          return nextStatus;
        }

        if (current === "offline" && nextStatus === "reconnecting") {
          if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current);
          }

          reconnectTimerRef.current = setTimeout(() => {
            setStatus("online");
            reconnectTimerRef.current = null;
          }, 2000);

          return nextStatus;
        }

        return nextStatus;
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
