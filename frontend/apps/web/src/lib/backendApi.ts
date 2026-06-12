import { getValidSupabaseAccessToken, handleExpiredSessionRedirect } from "@/lib/authSession";
import { buildRequestIdHeader } from "@/lib/observability";

const DEFAULT_BACKEND_TIMEOUT_MS = 12_000;
const DEFAULT_BACKEND_RETRY_DELAY_MS = 350;
const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

export type BackendHttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

type JsonBody = Record<string, unknown>;

interface BackendRequestErrorContext {
  status: number;
  payload: unknown;
  path: string;
  response: Response;
}

interface BackendJsonRequestParams {
  path: string;
  method?: BackendHttpMethod;
  accessToken?: string;
  body?: JsonBody | FormData;
  fallback: string;
  authProtected?: boolean;
  headers?: Record<string, string>;
  timeoutMs?: number;
  retries?: number;
  onError?: (context: BackendRequestErrorContext) => void;
}

export function getBackendApiBaseUrl(): string {
  const configured = import.meta.env.VITE_BACKEND_API_URL?.trim();
  const baseUrl = configured || "http://localhost:8000/api/v2";
  return baseUrl.replace(/\/api\/v1\/?$/, "/api/v2").replace(/\/+$/, "");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function isFormDataBody(body: JsonBody | FormData | undefined): body is FormData {
  return typeof FormData !== "undefined" && body instanceof FormData;
}

function shouldRetry(method: BackendHttpMethod, response: Response | null, attempt: number, maxRetries: number): boolean {
  if (attempt >= maxRetries) return false;
  if (method !== "GET") return false;
  if (!response) return true;
  return RETRYABLE_STATUS_CODES.has(response.status);
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<{ response: Response; timedOut: false }> {
  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });
    return { response, timedOut: false };
  } catch (error) {
    if (timedOut) {
      throw new Error("timeout");
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function fetchBackendResponse(params: {
  url: string;
  method: BackendHttpMethod;
  init: RequestInit;
  timeoutMs: number;
  retries: number;
}): Promise<Response> {
  const { url, method, init, timeoutMs, retries } = params;
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const { response } = await fetchWithTimeout(url, init, timeoutMs);
      if (shouldRetry(method, response, attempt, retries)) {
        await sleep(DEFAULT_BACKEND_RETRY_DELAY_MS * (attempt + 1));
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
      if (!shouldRetry(method, null, attempt, retries)) break;
      await sleep(DEFAULT_BACKEND_RETRY_DELAY_MS * (attempt + 1));
    }
  }

  if (lastError instanceof Error && lastError.message === "timeout") {
    throw new Error("O backend demorou para responder. Tente novamente em instantes.");
  }

  throw new Error("Não foi possível conectar ao backend do Kidario.");
}

export async function backendJsonRequest<TResponse>(params: BackendJsonRequestParams): Promise<TResponse> {
  const {
    path,
    method = "GET",
    accessToken,
    body,
    fallback,
    authProtected = Boolean(accessToken),
    headers,
    timeoutMs = DEFAULT_BACKEND_TIMEOUT_MS,
    retries = method === "GET" ? 1 : 0,
    onError,
  } = params;
  const bearerToken = accessToken ? await resolveProtectedAccessToken(accessToken) : null;
  const formDataBody = isFormDataBody(body);
  const requestHeaders = {
    ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
    Accept: "application/json",
    ...buildRequestIdHeader(),
    ...(body && !formDataBody ? { "Content-Type": "application/json" } : {}),
    ...headers,
  };

  const response = await fetchBackendResponse({
    url: `${getBackendApiBaseUrl()}${path}`,
    method,
    timeoutMs,
    retries,
    init: {
      method,
      headers: requestHeaders,
      body: body ? (formDataBody ? body : JSON.stringify(body)) : undefined,
    },
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    onError?.({
      status: response.status,
      payload,
      path,
      response,
    });

    throwBackendError({
      status: response.status,
      payload,
      fallback,
      authProtected,
    });
  }

  return payload as TResponse;
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
