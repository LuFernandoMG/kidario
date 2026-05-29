import {
  getBackendApiBaseUrl,
  resolveProtectedAccessToken,
  throwBackendError,
} from "@/lib/backendApi";
import { buildRequestIdHeader } from "@/lib/observability";
import {
  type BackendProfileStatusResponse,
  type BackendProfileView,
  profileBackendRequest,
} from "@/data/api/profiles";

interface AddressDetail {
  id?: string;
  street: string;
  number?: string | null;
  complement?: string | null;
  district: string;
  city: string;
  state: string;
  postal_code?: string | null;
  country?: string;
  latitude?: number | null;
  longitude?: number | null;
}

export interface BackendTeacherProfileResponse {
  id: string;
  profile: BackendProfileView;
  phone?: string | null;
  cpf?: string | null;
  professional_registration?: string | null;
  city?: string | null;
  state?: string | null;
  address_detail?: AddressDetail | null;
  modality?: string | null;
  mini_bio?: string | null;
  hourly_rate?: number | null;
  lesson_duration_minutes?: number | null;
  profile_photo_file_name?: string | null;
  profile_photo_url?: string | null;
  request_experience_anonymity: boolean;
  specialties: string[];
  formations: {
    id: string;
    degree_type: string;
    course_name: string;
    institution: string;
    completion_year?: string | null;
  }[];
  experiences: {
    id: string;
    institution: string;
    role: string;
    responsibilities: string;
    period_from: string;
    period_to?: string | null;
    current_position: boolean;
  }[];
  availability: {
    id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
  }[];
}

export interface TeacherFormationUpsertPayload {
  id?: string | null;
  degree_type: string;
  course_name: string;
  institution: string;
  completion_year?: string | null;
}

export interface TeacherExperienceUpsertPayload {
  id?: string | null;
  institution: string;
  role: string;
  responsibilities: string;
  period_from: string;
  period_to?: string | null;
  current_position: boolean;
}

export interface TeacherAvailabilityUpsertPayload {
  id?: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

export interface TeacherProfilePatchPayload {
  first_name?: string;
  last_name?: string;
  phone?: string;
  cpf?: string;
  professional_registration?: string;
  city?: string;
  state?: string;
  address_detail?: {
    street?: string;
    number?: string;
    complement?: string;
    district?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  };
  modality?: string;
  mini_bio?: string;
  hourly_rate?: number;
  lesson_duration_minutes?: number;
  profile_photo_file_name?: string | null;
  request_experience_anonymity?: boolean;
  specialties_ops?: {
    add: string[];
    remove: string[];
  };
  formations_ops?: {
    upsert: TeacherFormationUpsertPayload[];
    delete_ids: string[];
  };
  experiences_ops?: {
    upsert: TeacherExperienceUpsertPayload[];
    delete_ids: string[];
  };
  availability_ops?: {
    upsert: TeacherAvailabilityUpsertPayload[];
    delete_ids: string[];
  };
}

interface V2TeacherProfile {
  id: string;
  user: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    role: "parent" | "teacher" | "admin";
  };
  phone?: string | null;
  cpf_masked?: string | null;
  professional_number?: string | null;
  modality?: "online" | "presencial" | "ambos" | null;
  biography?: string | null;
  hourly_rate_cents?: number | null;
  lesson_duration_minutes?: number | null;
  profile_photo_file_name?: string | null;
  profile_photo_url?: string | null;
  hide_experience: boolean;
  address: AddressDetail;
  skills: { id: string; skill: string }[];
  academic_records: BackendTeacherProfileResponse["formations"];
  experiences: {
    id: string;
    institution: string;
    role: string;
    description: string;
    period_from: string;
    period_to?: string | null;
    current_position: boolean;
  }[];
  availability: BackendTeacherProfileResponse["availability"];
}

interface TeacherPhotoUploadResponse extends BackendProfileStatusResponse {
  profile_photo_file_name: string;
  profile_photo_url?: string | null;
}

function toBackendModality(value?: string) {
  if (value === "hibrido") return "ambos";
  if (value === "online" || value === "presencial" || value === "ambos") return value;
  return undefined;
}

function fromBackendModality(value?: string | null) {
  if (value === "ambos") return "hibrido";
  return value || "";
}

function mapTeacherProfile(payload: V2TeacherProfile): BackendTeacherProfileResponse {
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
    cpf: payload.cpf_masked,
    professional_registration: payload.professional_number,
    city: payload.address?.city,
    state: payload.address?.state,
    address_detail: payload.address,
    modality: fromBackendModality(payload.modality),
    mini_bio: payload.biography,
    hourly_rate: payload.hourly_rate_cents != null ? Math.round(payload.hourly_rate_cents / 100) : null,
    lesson_duration_minutes: payload.lesson_duration_minutes,
    profile_photo_file_name: payload.profile_photo_file_name,
    profile_photo_url: payload.profile_photo_url,
    request_experience_anonymity: payload.hide_experience,
    specialties: (payload.skills || []).map((skill) => skill.skill),
    formations: payload.academic_records || [],
    experiences: (payload.experiences || []).map((experience) => ({
      id: experience.id,
      institution: experience.institution,
      role: experience.role,
      responsibilities: experience.description,
      period_from: experience.period_from,
      period_to: experience.period_to,
      current_position: experience.current_position,
    })),
    availability: payload.availability || [],
  };
}

function mapTeacherPatchPayload(payload: TeacherProfilePatchPayload): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  if (payload.first_name !== undefined) next.first_name = payload.first_name;
  if (payload.last_name !== undefined) next.last_name = payload.last_name;
  if (payload.phone !== undefined) next.phone = payload.phone;
  if (payload.cpf !== undefined) next.cpf = payload.cpf;
  if (payload.professional_registration !== undefined) next.professional_number = payload.professional_registration;
  if (payload.modality !== undefined) next.modality = toBackendModality(payload.modality);
  if (payload.mini_bio !== undefined) next.biography = payload.mini_bio;
  if (payload.hourly_rate !== undefined) next.hourly_rate_cents = Math.round(payload.hourly_rate * 100);
  if (payload.lesson_duration_minutes !== undefined) next.lesson_duration_minutes = payload.lesson_duration_minutes;
  if (payload.profile_photo_file_name !== undefined) next.profile_photo_file_name = payload.profile_photo_file_name;
  if (payload.request_experience_anonymity !== undefined) next.hide_experience = payload.request_experience_anonymity;
  if (payload.address_detail !== undefined) {
    next.address = payload.address_detail;
  } else if (payload.city !== undefined || payload.state !== undefined) {
    next.address = {
      city: payload.city,
      state: payload.state,
    };
  }
  if (payload.specialties_ops) next.skills_ops = payload.specialties_ops;
  if (payload.formations_ops) next.academic_records_ops = payload.formations_ops;
  if (payload.experiences_ops) {
    next.experiences_ops = {
      delete_ids: payload.experiences_ops.delete_ids,
      upsert: payload.experiences_ops.upsert.map((experience) => ({
        id: experience.id,
        institution: experience.institution,
        role: experience.role,
        description: experience.responsibilities,
        period_from: experience.period_from,
        period_to: experience.period_to,
        current_position: experience.current_position,
      })),
    };
  }
  if (payload.availability_ops) next.availability_ops = payload.availability_ops;
  return next;
}

export async function getTeacherProfile(accessToken: string): Promise<BackendTeacherProfileResponse> {
  const payload = await profileBackendRequest<V2TeacherProfile>({
    path: "/teachers/me",
    accessToken,
    method: "GET",
    fallback: "Não foi possível carregar o perfil da professora.",
  });
  return mapTeacherProfile(payload);
}

export async function patchTeacherProfile(
  accessToken: string,
  payload: TeacherProfilePatchPayload,
): Promise<BackendProfileStatusResponse> {
  const updated = await profileBackendRequest<V2TeacherProfile>({
    path: "/teachers/me",
    accessToken,
    method: "PATCH",
    body: mapTeacherPatchPayload(payload),
  });
  return {
    status: "ok",
    user_id: updated.user.id,
    profile_id: updated.user.id,
    teacher_id: updated.id,
    role: "teacher",
  };
}

export async function uploadTeacherProfilePhoto(
  accessToken: string,
  file: File,
): Promise<TeacherPhotoUploadResponse> {
  const url = `${getBackendApiBaseUrl()}/teachers/me/photo`;
  const bearerToken = await resolveProtectedAccessToken(accessToken);
  const body = new FormData();
  body.append("file", file);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        Accept: "application/json",
        ...buildRequestIdHeader(),
      },
      body,
    });
  } catch {
    throw new Error("Não foi possível conectar ao backend do Kidario.");
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throwBackendError({
      status: response.status,
      payload,
      fallback: "Não foi possível enviar a foto de perfil.",
      authProtected: true,
    });
  }

  return payload as TeacherPhotoUploadResponse;
}
