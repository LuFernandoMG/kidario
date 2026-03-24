import type { BackendUserRole, ChildGender } from "@/types/common";

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
