import { getBackendApiBaseUrl, resolveProtectedAccessToken, throwBackendError } from "@/lib/backendApi";
import { buildRequestIdHeader } from "@/lib/observability";

export interface AdminTeacherRecord {
  profile_id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  city?: string | null;
  state?: string | null;
  modality?: string | null;
  hourly_rate?: number | null;
  formations: string[];
  experiences: string[];
  is_active_teacher: boolean;
  created_at: string;
}

export interface AdminParentRecord {
  profile_id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  address?: string | null;
  bio?: string | null;
  children_count: number;
  created_at: string;
}

export interface AdminBookingRecord {
  booking_id: string;
  parent_profile_id: string;
  parent_name: string;
  teacher_profile_id: string;
  teacher_name: string;
  child_id: string;
  child_name: string;
  date_iso: string;
  time: string;
  duration_minutes: number;
  modality: "online" | "presencial";
  booking_status: "pendente" | "confirmada" | "cancelada" | "concluida";
  payment_method: "cartao" | "pix";
  payment_status: "pendente" | "pago" | "falhou";
  price_total: number;
  currency: string;
  created_at: string;
}

export interface AdminPaymentRecord {
  booking_id: string;
  parent_profile_id: string;
  parent_name: string;
  teacher_profile_id: string;
  teacher_name: string;
  payment_method: "cartao" | "pix";
  payment_status: "pendente" | "pago" | "falhou";
  booking_status: "pendente" | "confirmada" | "cancelada" | "concluida";
  price_total: number;
  currency: string;
  created_at: string;
  updated_at: string;
}

export interface AdminDashboardResponse {
  teachers: AdminTeacherRecord[];
  parents: AdminParentRecord[];
  bookings: AdminBookingRecord[];
  payments: AdminPaymentRecord[];
}

export interface TeacherActivationResponse {
  status: "ok";
  profile_id: string;
  is_active_teacher: boolean;
}

export interface AdminAccessResponse {
  status: "ok";
  is_admin: boolean;
}

async function adminRequest<TResponse>(params: {
  path: string;
  accessToken: string;
  method?: "GET" | "PATCH";
  body?: Record<string, unknown>;
}): Promise<TResponse> {
  const { path, accessToken, method = "GET", body } = params;
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
      fallback: "Não foi possível carregar os dados do painel administrativo.",
      authProtected: true,
    });
  }

  return payload as TResponse;
}

export async function getAdminDashboard(accessToken: string): Promise<AdminDashboardResponse> {
  return adminRequest<AdminDashboardResponse>({
    path: "/admin/dashboard",
    accessToken,
  });
}

export async function getAdminAccess(accessToken: string): Promise<AdminAccessResponse> {
  return adminRequest<AdminAccessResponse>({
    path: "/admin/access",
    accessToken,
  });
}

export async function patchTeacherActivation(
  accessToken: string,
  profileId: string,
  isActiveTeacher: boolean,
): Promise<TeacherActivationResponse> {
  return adminRequest<TeacherActivationResponse>({
    path: `/admin/teachers/${profileId}/activation`,
    accessToken,
    method: "PATCH",
    body: { is_active_teacher: isActiveTeacher },
  });
}
