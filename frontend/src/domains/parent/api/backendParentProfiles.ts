import type { ChildGender } from "@/lib/childProfile";
import {
  type BackendProfileStatusResponse,
  type BackendProfileView,
  profileBackendRequest,
} from "@/domains/profile/api/backendProfileShared";

export interface BackendParentChildView {
  id: string;
  name: string;
  gender?: ChildGender | null;
  age?: number | null;
  current_grade?: string | null;
  birth_month_year?: string | null;
  school?: string | null;
  focus_points?: string | null;
}

export interface BackendParentProfileResponse {
  profile: BackendProfileView;
  phone?: string | null;
  cpf?: string | null;
  birth_date?: string | null;
  address?: string | null;
  bio?: string | null;
  children: BackendParentChildView[];
}

export interface ParentChildUpsertPayload {
  id?: string | null;
  name: string;
  gender?: ChildGender | null;
  age?: number | null;
  current_grade?: string | null;
  birth_month_year?: string | null;
  school?: string | null;
  focus_points?: string | null;
}

export interface ParentProfilePatchPayload {
  first_name?: string;
  last_name?: string;
  phone?: string;
  cpf?: string;
  birth_date?: string;
  address?: string;
  bio?: string;
  children_ops?: {
    upsert: ParentChildUpsertPayload[];
    delete_ids: string[];
  };
}

export async function patchParentProfile(
  accessToken: string,
  payload: ParentProfilePatchPayload,
): Promise<BackendProfileStatusResponse> {
  return profileBackendRequest<BackendProfileStatusResponse>({
    path: "/profiles/parent",
    accessToken,
    method: "PATCH",
    body: payload as Record<string, unknown>,
  });
}

export async function getParentProfile(accessToken: string): Promise<BackendParentProfileResponse> {
  return profileBackendRequest<BackendParentProfileResponse>({
    path: "/profiles/parent",
    accessToken,
    method: "GET",
    fallback: "Não foi possível carregar o perfil do responsável.",
  });
}
