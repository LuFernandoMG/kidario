export type BackendUserRole = "parent" | "teacher";

export interface ParentChildUpsertPayload {
  name: string;
  gender?: string | null;
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
  birth_date?: string;
  address?: string;
  bio?: string;
  children_ops?: {
    upsert: ParentChildUpsertPayload[];
    delete_ids: string[];
  };
}

export interface TeacherFormationUpsertPayload {
  degree_type: string;
  course_name: string;
  institution: string;
  completion_year?: string | null;
}

export interface TeacherExperienceUpsertPayload {
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

interface StatusResponse {
  status: "ok";
  profile_id: string;
  role: BackendUserRole;
}

function getBackendApiBaseUrl(): string {
  const configured = import.meta.env.VITE_BACKEND_API_URL?.trim();
  const baseUrl = configured || "http://localhost:8000/api/v1";
  return baseUrl.replace(/\/+$/, "");
}

function extractErrorMessage(payload: unknown, fallback: string): string {
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

async function backendRequest<TResponse>(params: {
  path: string;
  accessToken: string;
  method?: "GET" | "PATCH" | "POST";
  body?: Record<string, unknown>;
}): Promise<TResponse> {
  const { path, accessToken, method = "GET", body } = params;
  const url = `${getBackendApiBaseUrl()}${path}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("No fue posible conectar con el backend de Kidario.");
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const fallback = "No fue posible guardar el perfil en el backend.";
    throw new Error(extractErrorMessage(payload, fallback));
  }

  return payload as TResponse;
}

export async function patchParentProfile(
  accessToken: string,
  payload: ParentProfilePatchPayload,
): Promise<StatusResponse> {
  return backendRequest<StatusResponse>({
    path: "/profiles/parent",
    accessToken,
    method: "PATCH",
    body: payload as Record<string, unknown>,
  });
}

export async function patchTeacherProfile(
  accessToken: string,
  payload: TeacherProfilePatchPayload,
): Promise<StatusResponse> {
  return backendRequest<StatusResponse>({
    path: "/profiles/teacher",
    accessToken,
    method: "PATCH",
    body: payload as Record<string, unknown>,
  });
}
