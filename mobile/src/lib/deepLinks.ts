import { buildFrontendChatPath, frontendRoutes } from "@/routes/frontend";

function safelyParseUrl(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

function normalizeIncomingPath(parsed: URL): string {
  const explicitPath = parsed.searchParams.get("path");
  if (explicitPath) {
    return explicitPath.startsWith("/") ? explicitPath : `/${explicitPath}`;
  }

  if (parsed.protocol === "kidario-mobile:") {
    const hostPath = parsed.hostname ? `/${parsed.hostname}` : "";
    const pathname = parsed.pathname === "/" ? "" : parsed.pathname;
    return `${hostPath}${pathname}` || "/";
  }

  return parsed.pathname || "/";
}

function buildShellQuery(parsed: URL): string {
  const next = new URLSearchParams(parsed.searchParams);
  next.delete("path");
  const query = next.toString();
  return query ? `?${query}` : "";
}

export function resolveShellHrefFromDeepLink(url: string): string | null {
  const parsed = safelyParseUrl(url);
  if (!parsed) {
    return null;
  }

  const normalizedPath = normalizeIncomingPath(parsed);
  const query = buildShellQuery(parsed);

  if (normalizedPath === frontendRoutes.shared.root) return `/${query}`;
  if (normalizedPath === frontendRoutes.shared.login) return `/login${query}`;
  if (normalizedPath === frontendRoutes.shared.recoverPassword) return `/recover-password${query}`;
  if (normalizedPath === frontendRoutes.shared.resetPassword || normalizedPath === "/reset-password") {
    return `/reset-password${query}`;
  }

  if (normalizedPath === frontendRoutes.parent.signup) return `/signup${query}`;
  if (normalizedPath === frontendRoutes.parent.explore) return `/explore${query}`;
  if (normalizedPath === frontendRoutes.parent.profile) return `/profile${query}`;
  if (normalizedPath === frontendRoutes.parent.agenda) return `/agenda${query}`;

  if (normalizedPath === frontendRoutes.teacher.home) return `/home${query}`;
  if (normalizedPath === frontendRoutes.teacher.students) return `/students${query}`;
  if (normalizedPath === frontendRoutes.teacher.planning) return `/planning${query}`;
  if (normalizedPath === frontendRoutes.teacher.finance) return `/finance${query}`;
  if (normalizedPath === frontendRoutes.teacher.privateSignup) return `/private-signup${query}`;

  const chatMatch = normalizedPath.match(/^\/chat\/([^/]+)$/);
  if (chatMatch) {
    return `/chat/${encodeURIComponent(chatMatch[1])}${query}`;
  }

  return null;
}

export function buildInternalDeepLink(frontendPath: string): string {
  return `kidario-mobile://open?path=${encodeURIComponent(frontendPath)}`;
}

export function buildResetPasswordDeepLink(searchParams?: Record<string, string>) {
  const query = searchParams ? new URLSearchParams(searchParams).toString() : "";
  return `kidario-mobile://reset-password${query ? `?${query}` : ""}`;
}

export function buildChatDeepLink(threadId: string) {
  return buildInternalDeepLink(buildFrontendChatPath(threadId));
}
