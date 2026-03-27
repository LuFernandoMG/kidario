import { useLocalSearchParams } from "expo-router";

import { FrontendShellScreen } from "@/components/webview/FrontendShellScreen";
import { buildBookingSchedulerPath } from "@/routes/frontend";

export default function BookingSchedulerScreen() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const teacherId = Array.isArray(id) ? id[0] : id;

  return <FrontendShellScreen path={buildBookingSchedulerPath(teacherId ?? "")} />;
}
