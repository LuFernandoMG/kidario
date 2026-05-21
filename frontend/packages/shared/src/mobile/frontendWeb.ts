export const DEFAULT_FRONTEND_WEB_URL = "http://localhost:8080";

export function normalizeFrontendWebBaseUrl(baseUrl: string | undefined | null): string {
  return (baseUrl ?? DEFAULT_FRONTEND_WEB_URL).trim().replace(/\/+$/, "");
}

export function buildFrontendUrl(baseUrl: string, path = "/"): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizeFrontendWebBaseUrl(baseUrl)}${normalizedPath}`;
}

export function isValidFrontendWebUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function getFrontendOrigin(baseUrl: string): string {
  return new URL(normalizeFrontendWebBaseUrl(baseUrl)).origin;
}

export function isInternalFrontendUrl(url: string, baseUrl: string): boolean {
  if (url === "about:blank") {
    return true;
  }

  if (!isValidFrontendWebUrl(url)) {
    return false;
  }

  return new URL(url).origin === getFrontendOrigin(baseUrl);
}

export function isOpenableExternalUrl(url: string): boolean {
  return /^(https?:|mailto:|tel:)/.test(url);
}
