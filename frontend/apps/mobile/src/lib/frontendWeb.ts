const DEFAULT_FRONTEND_WEB_URL = "http://localhost:8080";

export function getFrontendWebBaseUrl(): string {
  return (process.env.EXPO_PUBLIC_FRONTEND_WEB_URL ?? DEFAULT_FRONTEND_WEB_URL).trim().replace(/\/+$/, "");
}

export function buildFrontendUrl(path = "/"): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getFrontendWebBaseUrl()}${normalizedPath}`;
}

export function isValidFrontendWebUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function getFrontendOrigin(): string {
  return new URL(getFrontendWebBaseUrl()).origin;
}

export function isInternalFrontendUrl(url: string): boolean {
  if (url === "about:blank") {
    return true;
  }

  if (!isValidFrontendWebUrl(url)) {
    return false;
  }

  return new URL(url).origin === getFrontendOrigin();
}

export function isOpenableExternalUrl(url: string): boolean {
  return /^(https?:|mailto:|tel:)/.test(url);
}
