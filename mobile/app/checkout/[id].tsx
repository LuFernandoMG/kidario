import { useLocalSearchParams } from "expo-router";

import { FrontendShellScreen } from "@/components/webview/FrontendShellScreen";
import { buildCheckoutPath } from "@/routes/frontend";

export default function CheckoutScreen() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const teacherId = Array.isArray(id) ? id[0] : id;

  return <FrontendShellScreen path={buildCheckoutPath(teacherId ?? "")} />;
}
