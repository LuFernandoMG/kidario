import {
  backendJsonRequest,
} from "@/lib/backendApi";

export type BackendUserRole = "parent" | "teacher" | "admin";

export interface BackendProfileView {
  id: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  role: BackendUserRole;
}

export interface BackendUserView extends BackendProfileView {
  auth_email_confirmed: boolean;
  created_at: string;
  updated_at: string;
}

export interface BackendV2MeResponse {
  user: BackendUserView;
  parent_id?: string | null;
  teacher_id?: string | null;
  admin?: { is_admin: boolean } | null;
}

export interface BackendMeResponse {
  profile: BackendProfileView;
  parent_profile_exists: boolean;
  teacher_profile_exists: boolean;
  parent_id?: string | null;
  teacher_id?: string | null;
  is_admin?: boolean;
}

export interface BackendProfileStatusResponse {
  status: "ok";
  user_id?: string;
  profile_id?: string;
  parent_id?: string | null;
  teacher_id?: string | null;
  role: BackendUserRole;
}

export async function profileBackendRequest<TResponse>(params: {
  path: string;
  accessToken: string;
  method?: "GET" | "PATCH" | "POST" | "DELETE";
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

  return backendJsonRequest<TResponse>({
    path,
    accessToken,
    method,
    body,
    fallback,
    authProtected: true,
  });
}

export async function getMyProfile(accessToken: string): Promise<BackendMeResponse> {
  const payload = await profileBackendRequest<BackendV2MeResponse>({
    path: "/me",
    accessToken,
    method: "GET",
    fallback: "Não foi possível carregar o perfil.",
  });
  return {
    profile: {
      id: payload.user.id,
      email: payload.user.email,
      first_name: payload.user.first_name,
      last_name: payload.user.last_name,
      role: payload.user.role,
    },
    parent_profile_exists: Boolean(payload.parent_id),
    teacher_profile_exists: Boolean(payload.teacher_id),
    parent_id: payload.parent_id,
    teacher_id: payload.teacher_id,
    is_admin: Boolean(payload.admin?.is_admin || payload.user.role === "admin"),
  };
}
