import { useLocalSearchParams } from "expo-router";

import { FrontendShellScreen } from "@/components/webview/FrontendShellScreen";
import { buildBookingDetailPath } from "@/routes/frontend";

export default function BookingDetailScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId?: string | string[] }>();
  const normalizedBookingId = Array.isArray(bookingId) ? bookingId[0] : bookingId;

  return <FrontendShellScreen path={buildBookingDetailPath(normalizedBookingId ?? "")} />;
}
