import {
  getBackendApiBaseUrl,
  resolveProtectedAccessToken,
  throwBackendError,
} from "@/lib/backendApi";
import { buildRequestIdHeader } from "@/lib/observability";

export type BackendUserRole = "parent" | "teacher";

export interface BackendProfileView {
  id: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  role: BackendUserRole;
}

export interface BackendMeResponse {
  profile: BackendProfileView;
  parent_profile_exists: boolean;
  teacher_profile_exists: boolean;
}

export interface BackendProfileStatusResponse {
  status: "ok";
  profile_id: string;
  role: BackendUserRole;
}

export async function profileBackendRequest<TResponse>(params: {
  path: string;
  accessToken: string;
  method?: "GET" | "PATCH";
  body?: Record<string, unknown>;
  fallback?: string;
}): Promise<TResponse> {
  const {
    path,
    accessToken,
    method = "GET",
    body,
    fallback = "Não foi possível salvar o perfil no backend.",
  } = params;

  const url = `${getBackendApiBaseUrl()}${path}`;
  const bearerToken = await resolveProtectedAccessToken(accessToken);

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        Accept: "application/json",
        ...buildRequestIdHeader(),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("Não foi possível conectar ao backend do Kidario.");
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throwBackendError({
      status: response.status,
      payload,
      fallback,
      authProtected: true,
    });
  }

  return payload as TResponse;
}

export async function getMyProfile(accessToken: string): Promise<BackendMeResponse> {
  return profileBackendRequest<BackendMeResponse>({
    path: "/profiles/me",
    accessToken,
    method: "GET",
    fallback: "Não foi possível carregar o perfil.",
  });
}
