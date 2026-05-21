export type NetworkStatus = "online" | "offline" | "reconnecting";

export function resolveNetworkStatusTransition(current: NetworkStatus, isOnline: boolean): NetworkStatus {
  if (!isOnline) {
    return "offline";
  }

  if (current === "offline" || current === "reconnecting") {
    return "reconnecting";
  }

  return "online";
}
