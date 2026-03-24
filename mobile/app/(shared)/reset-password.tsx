import { useLocalSearchParams } from "expo-router";

import { FrontendShellScreen } from "@/components/webview/FrontendShellScreen";
import { buildFrontendPathWithQuery, frontendRoutes } from "@/routes/frontend";

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams();
  return (
    <FrontendShellScreen
      path={buildFrontendPathWithQuery(
        frontendRoutes.shared.resetPassword,
        params as Record<string, string | string[] | undefined>,
      )}
    />
  );
}
