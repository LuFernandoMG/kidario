import { useEffect, useRef, useState } from "react";

import { resolveNetworkStatusTransition, type NetworkStatus } from "@kidario/shared/mobile/networkStatus";

export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>(() =>
    typeof navigator !== "undefined" && navigator.onLine === false ? "offline" : "online",
  );
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const handleOnline = () => {
      setStatus((current) => {
        const nextStatus = resolveNetworkStatusTransition(current, true);

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
    };

    const handleOffline = () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      setStatus((current) => resolveNetworkStatusTransition(current, false));
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
    };
  }, []);

  return status;
}
