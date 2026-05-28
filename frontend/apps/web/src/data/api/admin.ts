import { getBackendApiBaseUrl, resolveProtectedAccessToken, throwBackendError } from "@/lib/backendApi";
import { buildRequestIdHeader } from "@/lib/observability";

export interface AdminTeacherRecord {
  profile_id: string;
  teacher_id: string;
  user_id: string;
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
  parent_id: string;
  user_id: string;
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
  parent_id: string;
  parent_name: string;
  teacher_profile_id: string;
  teacher_id: string;
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
  payment_order_id: string;
  booking_id: string;
  parent_profile_id: string;
  parent_id: string;
  parent_name: string;
  teacher_profile_id: string;
  teacher_id?: string | null;
  teacher_name?: string | null;
  payment_method?: "credit_card" | "pix" | "boleto" | null;
  payment_status: string;
  booking_status?: "pendente" | "confirmada" | "cancelada" | "concluida" | null;
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
  teacher_id: string;
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
  const response = await adminRequest<{
    teachers: Array<Omit<AdminTeacherRecord, "profile_id" | "hourly_rate" | "formations" | "is_active_teacher"> & {
      teacher_id: string;
      hourly_rate_cents?: number | null;
      academic_records: string[];
      is_active: boolean;
    }>;
    parents: Array<Omit<AdminParentRecord, "profile_id" | "address"> & {
      parent_id: string;
      city: string;
      state: string;
    }>;
    bookings: Array<Omit<AdminBookingRecord, "parent_profile_id" | "teacher_profile_id" | "date_iso" | "time" | "price_total"> & {
      parent_id: string;
      teacher_id: string;
      starts_at: string;
      amount_cents: number;
    }>;
    payments: Array<Omit<AdminPaymentRecord, "parent_profile_id" | "teacher_profile_id" | "price_total"> & {
      parent_id: string;
      teacher_id?: string | null;
      amount_cents: number;
    }>;
  }>({
    path: "/admin/dashboard",
    accessToken,
  });

  return {
    teachers: response.teachers.map((teacher) => ({
      ...teacher,
      profile_id: teacher.teacher_id,
      teacher_id: teacher.teacher_id,
      hourly_rate: teacher.hourly_rate_cents != null ? Math.round(teacher.hourly_rate_cents / 100) : null,
      formations: teacher.academic_records || [],
      is_active_teacher: teacher.is_active,
    })),
    parents: response.parents.map((parent) => ({
      ...parent,
      profile_id: parent.parent_id,
      parent_id: parent.parent_id,
      address: [parent.city, parent.state].filter(Boolean).join(", "),
    })),
    bookings: response.bookings.map((booking) => {
      const startsAt = new Date(booking.starts_at);
      return {
        ...booking,
        parent_profile_id: booking.parent_id,
        teacher_profile_id: booking.teacher_id,
        date_iso: Number.isNaN(startsAt.getTime()) ? booking.starts_at.slice(0, 10) : startsAt.toISOString().slice(0, 10),
        time: Number.isNaN(startsAt.getTime())
          ? ""
          : startsAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        price_total: Math.round((booking.amount_cents || 0) / 100),
        payment_method: "pix",
        payment_status: "created",
      };
    }),
    payments: response.payments.map((payment) => ({
      ...payment,
      booking_id: payment.booking_id || "",
      parent_profile_id: payment.parent_id,
      teacher_profile_id: payment.teacher_id || "",
      price_total: Math.round((payment.amount_cents || 0) / 100),
    })),
  };
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
  const response = await adminRequest<{ status: "ok"; teacher_id: string; is_active: boolean }>({
    path: `/admin/teachers/${profileId}/activation`,
    accessToken,
    method: "PATCH",
    body: { is_active: isActiveTeacher },
  });
  return {
    status: response.status,
    profile_id: response.teacher_id,
    teacher_id: response.teacher_id,
    is_active_teacher: response.is_active,
  };
}
