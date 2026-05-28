import type { ChildGender } from "@/lib/childProfile";
import {
  type BackendProfileStatusResponse,
  type BackendProfileView,
  profileBackendRequest,
} from "@/data/api/profiles";

export interface BackendParentChildView {
  id: string;
  parent_id?: string;
  name: string;
  gender?: ChildGender | null;
  age?: number | null;
  current_grade?: string | null;
  birth_month_year?: string | null;
  school?: string | null;
  focus_points?: string | null;
}

export interface BackendParentProfileResponse {
  id: string;
  profile: BackendProfileView;
  phone?: string | null;
  cpf?: string | null;
  cpf_masked?: string | null;
  birth_date?: string | null;
  address?: string | null;
  address_detail?: {
    id: string;
    street: string;
    number?: string | null;
    complement?: string | null;
    district: string;
    city: string;
    state: string;
    postal_code?: string | null;
    country: string;
    latitude?: number | null;
    longitude?: number | null;
  } | null;
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

interface V2ParentProfile {
  id: string;
  user: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    role: "parent" | "teacher" | "admin";
  };
  phone: string;
  birth_date: string;
  cpf_masked?: string | null;
  bio?: string | null;
  address: BackendParentProfileResponse["address_detail"];
  children: BackendParentChildView[];
}

function formatAddress(address: BackendParentProfileResponse["address_detail"]) {
  if (!address) return "";
  return [
    address.street,
    address.number,
    address.district,
    address.city,
    address.state,
  ].filter(Boolean).join(", ");
}

function calculateAgeFromMonthYear(value?: string | null) {
  if (!value) return null;
  const [year, month] = value.split("-").map(Number);
  if (!year || !month) return null;
  const today = new Date();
  let age = today.getFullYear() - year;
  if (today.getMonth() + 1 < month) age -= 1;
  return age >= 0 ? age : null;
}

function mapParentProfile(payload: V2ParentProfile): BackendParentProfileResponse {
  return {
    id: payload.id,
    profile: {
      id: payload.user.id,
      email: payload.user.email,
      first_name: payload.user.first_name,
      last_name: payload.user.last_name,
      role: payload.user.role,
    },
    phone: payload.phone,
    cpf_masked: payload.cpf_masked,
    birth_date: payload.birth_date,
    address: formatAddress(payload.address),
    address_detail: payload.address,
    bio: payload.bio,
    children: (payload.children || []).map((child) => ({
      ...child,
      age: child.age ?? calculateAgeFromMonthYear(child.birth_month_year),
    })),
  };
}

export async function patchParentProfile(
  accessToken: string,
  payload: ParentProfilePatchPayload,
): Promise<BackendProfileStatusResponse> {
  const parentPayload: Record<string, unknown> = {};
  if (payload.first_name !== undefined) parentPayload.first_name = payload.first_name;
  if (payload.last_name !== undefined) parentPayload.last_name = payload.last_name;
  if (payload.phone !== undefined) parentPayload.phone = payload.phone;
  if (payload.cpf !== undefined) parentPayload.cpf = payload.cpf;
  if (payload.birth_date !== undefined) parentPayload.birth_date = payload.birth_date;
  if (payload.bio !== undefined) parentPayload.bio = payload.bio;
  if (payload.address !== undefined) {
    parentPayload.address = {
      street: payload.address,
    };
  }

  const updatedParent = Object.keys(parentPayload).length
    ? await profileBackendRequest<V2ParentProfile>({
        path: "/parents/me",
        accessToken,
        method: "PATCH",
        body: parentPayload,
      })
    : await profileBackendRequest<V2ParentProfile>({
        path: "/parents/me",
        accessToken,
        method: "GET",
      });

  if (payload.children_ops) {
    for (const childId of payload.children_ops.delete_ids) {
      await profileBackendRequest<{ status: "ok"; child_id: string }>({
        path: `/parents/me/children/${childId}`,
        accessToken,
        method: "DELETE",
      });
    }

    for (const child of payload.children_ops.upsert) {
      const childPayload = {
        name: child.name,
        gender: child.gender,
        birth_month_year: child.birth_month_year,
        current_grade: child.current_grade,
        school: child.school,
        focus_points: child.focus_points,
      };
      if (child.id) {
        await profileBackendRequest<BackendParentChildView>({
          path: `/parents/me/children/${child.id}`,
          accessToken,
          method: "PATCH",
          body: childPayload,
        });
      } else {
        await profileBackendRequest<BackendParentChildView>({
          path: "/parents/me/children",
          accessToken,
          method: "POST",
          body: childPayload,
        });
      }
    }
  }

  return {
    status: "ok",
    user_id: updatedParent.user.id,
    profile_id: updatedParent.user.id,
    parent_id: updatedParent.id,
    role: "parent",
  };
}

export async function getParentProfile(accessToken: string): Promise<BackendParentProfileResponse> {
  const payload = await profileBackendRequest<V2ParentProfile>({
    path: "/parents/me",
    accessToken,
    method: "GET",
    fallback: "Não foi possível carregar o perfil do responsável.",
  });
  return mapParentProfile(payload);
}
