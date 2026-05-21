import {
  buildFrontendUrl as buildSharedFrontendUrl,
  getFrontendOrigin as getSharedFrontendOrigin,
  isInternalFrontendUrl as isSharedInternalFrontendUrl,
  isOpenableExternalUrl,
  isValidFrontendWebUrl,
  normalizeFrontendWebBaseUrl,
} from "@kidario/shared/mobile/frontendWeb";

export function getFrontendWebBaseUrl(): string {
  return normalizeFrontendWebBaseUrl(process.env.EXPO_PUBLIC_FRONTEND_WEB_URL);
}

export function buildFrontendUrl(path = "/"): string {
  return buildSharedFrontendUrl(getFrontendWebBaseUrl(), path);
}

export function getFrontendOrigin(): string {
  return getSharedFrontendOrigin(getFrontendWebBaseUrl());
}

export function isInternalFrontendUrl(url: string): boolean {
  return isSharedInternalFrontendUrl(url, getFrontendWebBaseUrl());
}

export { isOpenableExternalUrl, isValidFrontendWebUrl };
