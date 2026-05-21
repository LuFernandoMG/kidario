import {
  RESET_PASSWORD_PATH,
  ROOT_PATH,
  buildChatPath,
  isBlockedMobilePath,
  normalizeFrontendPath,
} from "../routes/frontend";

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

  const normalizedPath = normalizeFrontendPath(normalizeIncomingPath(parsed));
  const query = buildShellQuery(parsed);

  if (isBlockedMobilePath(normalizedPath)) {
    return ROOT_PATH;
  }

  if (normalizedPath === "/reset-password") {
    return `${RESET_PASSWORD_PATH}${query}`;
  }

  return `${normalizedPath}${query}`;
}

export function buildInternalDeepLink(frontendPath: string): string {
  return `kidario-mobile://open?path=${encodeURIComponent(normalizeFrontendPath(frontendPath))}`;
}

export function buildResetPasswordDeepLink(searchParams?: Record<string, string>) {
  const query = searchParams ? new URLSearchParams(searchParams).toString() : "";
  return `kidario-mobile://reset-password${query ? `?${query}` : ""}`;
}

export function buildChatDeepLink(threadId: string) {
  return buildInternalDeepLink(buildChatPath(threadId));
}
