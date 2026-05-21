import { useEffect } from "react";

import { FrontendShellLoading } from "@/components/webview/FrontendShellLoading";
import { buildFrontendUrl } from "@/lib/frontendWeb";

interface FrontendShellProps {
  path?: string;
}

export function FrontendShell({ path = "/" }: FrontendShellProps) {
  const targetUrl = buildFrontendUrl(path);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    if (window.location.href !== targetUrl) {
      const timeoutId = window.setTimeout(() => {
        window.location.replace(targetUrl);
      }, 120);

      return () => window.clearTimeout(timeoutId);
    }
    return undefined;
  }, [targetUrl]);

  return <FrontendShellLoading message="Redirecionando." targetUrl={targetUrl} />;
}
