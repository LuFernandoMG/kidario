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
} from "@/domains/profile/api/backendProfileShared";

export interface BackendTeacherProfileResponse {
  profile: BackendProfileView;
  phone?: string | null;
  cpf?: string | null;
  professional_registration?: string | null;
  city?: string | null;
  state?: string | null;
  modality?: string | null;
  mini_bio?: string | null;
  hourly_rate?: number | null;
  lesson_duration_minutes?: number | null;
  profile_photo_file_name?: string | null;
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

interface TeacherPhotoUploadResponse extends BackendProfileStatusResponse {
  profile_photo_file_name: string;
}

export async function getTeacherProfile(accessToken: string): Promise<BackendTeacherProfileResponse> {
  return profileBackendRequest<BackendTeacherProfileResponse>({
    path: "/profiles/teacher",
    accessToken,
    method: "GET",
    fallback: "Não foi possível carregar o perfil da professora.",
  });
}

export async function patchTeacherProfile(
  accessToken: string,
  payload: TeacherProfilePatchPayload,
): Promise<BackendProfileStatusResponse> {
  return profileBackendRequest<BackendProfileStatusResponse>({
    path: "/profiles/teacher",
    accessToken,
    method: "PATCH",
    body: payload as Record<string, unknown>,
  });
}

export async function uploadTeacherProfilePhoto(
  accessToken: string,
  file: File,
): Promise<TeacherPhotoUploadResponse> {
  const url = `${getBackendApiBaseUrl()}/profiles/teacher/photo`;
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
