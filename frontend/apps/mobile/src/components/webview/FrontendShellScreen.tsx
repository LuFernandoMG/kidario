import { FrontendShell } from "@/components/webview/FrontendShell";

interface FrontendShellScreenProps {
  path?: string;
}

export function FrontendShellScreen({ path = "/" }: FrontendShellScreenProps) {
  return <FrontendShell path={path} />;
}
