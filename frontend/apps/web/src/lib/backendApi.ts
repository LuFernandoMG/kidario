import { getValidSupabaseAccessToken, handleExpiredSessionRedirect } from "@/lib/authSession";

export function getBackendApiBaseUrl(): string {
  const configured = import.meta.env.VITE_BACKEND_API_URL?.trim();
  const baseUrl = configured || "http://localhost:8000/api/v1";
  return baseUrl.replace(/\/+$/, "");
}

export function extractErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;

  const detail = (payload as { detail?: unknown }).detail;
  if (typeof detail === "string" && detail.trim()) return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    const firstMessage = detail
      .map((item) => (item && typeof item === "object" ? (item as { msg?: unknown }).msg : null))
      .find((msg) => typeof msg === "string" && msg.trim());
    if (typeof firstMessage === "string") return firstMessage;
  }

  return fallback;
}

function isSessionExpiredResponse(status: number, payload: unknown): boolean {
  if (status === 401) return true;
  if (status !== 403) return false;

  const message = extractErrorMessage(payload, "").toLowerCase();
  return /(token|jwt|expired|auth|credentials|session)/.test(message);
}

export function throwBackendError(params: {
  status: number;
  payload: unknown;
  fallback: string;
  authProtected?: boolean;
}): never {
  const { status, payload, fallback, authProtected = false } = params;

  if (authProtected && isSessionExpiredResponse(status, payload)) {
    handleExpiredSessionRedirect();
    throw new Error("Sua sessão expirou. Faça login novamente.");
  }

  throw new Error(extractErrorMessage(payload, fallback));
}

export async function resolveProtectedAccessToken(fallbackAccessToken?: string): Promise<string> {
  const validToken = await getValidSupabaseAccessToken();
  if (validToken) return validToken;
  if (fallbackAccessToken) return fallbackAccessToken;

  handleExpiredSessionRedirect();
  throw new Error("Sua sessão expirou. Faça login novamente.");
}
