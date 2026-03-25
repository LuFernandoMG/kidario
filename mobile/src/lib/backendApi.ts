import { getBackendApiUrl } from "@/lib/env";
import { extractErrorMessage } from "@/lib/error";

export function getBackendApiBaseUrl(): string {
  return getBackendApiUrl().replace(/\/+$/, "");
}

export function throwBackendError(params: {
  status: number;
  payload: unknown;
  fallback: string;
  authProtected?: boolean;
}): never {
  const { payload, fallback } = params;
  throw new Error(extractErrorMessage(payload, fallback));
}

export async function resolveProtectedAccessToken(fallbackAccessToken?: string): Promise<string> {
  if (fallbackAccessToken) return fallbackAccessToken;
  throw new Error("Sua sessão expirou. Faça login novamente.");
}
