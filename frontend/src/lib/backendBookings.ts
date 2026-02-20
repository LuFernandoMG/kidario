export type BookingStatus = "pendente" | "confirmada" | "cancelada" | "concluida";
export type BookingModality = "online" | "presencial";

export interface CreateBookingPayload {
  parent_profile_id?: string;
  child_id?: string;
  teacher_profile_id: string;
  date_iso: string;
  time: string;
  duration_minutes: number;
  modality: BookingModality;
  payment_method: "cartao" | "pix";
  coupon_code?: string;
}

export interface CreateBookingResponse {
  status: "ok";
  booking_id: string;
  booking_status: BookingStatus;
  payment_status: "pendente" | "pago" | "falhou";
}

export interface ParentAgendaLesson {
  id: string;
  teacher_id: string;
  teacher_name: string;
  teacher_avatar_url?: string | null;
  specialty?: string | null;
  child_id: string;
  child_name: string;
  date_iso: string;
  date_label: string;
  time: string;
  modality: BookingModality;
  status: BookingStatus;
  created_at_iso: string;
  updated_at_iso: string;
}

export interface ParentAgendaResponse {
  lessons: ParentAgendaLesson[];
}

export interface BookingDetailFollowUp {
  updated_at: string;
  summary: string;
  next_steps: string;
  tags: string[];
  attention_points: string[];
}

export interface BookingDetailResponse {
  id: string;
  parent_profile_id: string;
  child_id: string;
  child_name: string;
  teacher_id: string;
  teacher_name: string;
  teacher_avatar_url?: string | null;
  specialty?: string | null;
  date_iso: string;
  date_label: string;
  time: string;
  duration_minutes: number;
  modality: BookingModality;
  status: BookingStatus;
  price_total: number;
  currency: string;
  cancellation_reason?: string | null;
  latest_follow_up?: BookingDetailFollowUp | null;
  actions: {
    can_reschedule: boolean;
    can_cancel: boolean;
    can_complete: boolean;
  };
}

export interface RescheduleBookingPayload {
  new_date_iso: string;
  new_time: string;
  reason?: string;
}

export interface RescheduleBookingResponse {
  status: "ok";
  booking_id: string;
  date_iso: string;
  time: string;
  booking_status: BookingStatus;
  updated_at_iso: string;
}

export interface CancelBookingPayload {
  reason: string;
}

export interface CancelBookingResponse {
  status: "ok";
  booking_id: string;
  booking_status: BookingStatus;
  cancellation_reason: string;
  updated_at_iso: string;
}

export interface TeacherAvailabilityDay {
  date_iso: string;
  date_label: string;
  times: string[];
}

export interface TeacherAvailabilitySlotsResponse {
  teacher_profile_id: string;
  slots: TeacherAvailabilityDay[];
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
    const fallback = "No fue posible procesar la operación en el backend.";
    throw new Error(extractErrorMessage(payload, fallback));
  }

  return payload as TResponse;
}

export async function createBooking(
  accessToken: string,
  payload: CreateBookingPayload,
): Promise<CreateBookingResponse> {
  return backendRequest<CreateBookingResponse>({
    path: "/bookings",
    accessToken,
    method: "POST",
    body: payload as Record<string, unknown>,
  });
}

export async function getParentAgenda(
  accessToken: string,
  params: { tab: "upcoming" | "past"; childId?: string },
): Promise<ParentAgendaResponse> {
  const query = new URLSearchParams();
  query.set("tab", params.tab);
  if (params.childId) query.set("child_id", params.childId);

  return backendRequest<ParentAgendaResponse>({
    path: `/bookings/parent/agenda?${query.toString()}`,
    accessToken,
  });
}

export async function getBookingDetail(
  accessToken: string,
  bookingId: string,
): Promise<BookingDetailResponse> {
  return backendRequest<BookingDetailResponse>({
    path: `/bookings/${bookingId}`,
    accessToken,
  });
}

export async function rescheduleBooking(
  accessToken: string,
  bookingId: string,
  payload: RescheduleBookingPayload,
): Promise<RescheduleBookingResponse> {
  return backendRequest<RescheduleBookingResponse>({
    path: `/bookings/${bookingId}/reschedule`,
    accessToken,
    method: "PATCH",
    body: payload as Record<string, unknown>,
  });
}

export async function cancelBooking(
  accessToken: string,
  bookingId: string,
  payload: CancelBookingPayload,
): Promise<CancelBookingResponse> {
  return backendRequest<CancelBookingResponse>({
    path: `/bookings/${bookingId}/cancel`,
    accessToken,
    method: "PATCH",
    body: payload as Record<string, unknown>,
  });
}

export async function getTeacherAvailabilitySlots(
  accessToken: string,
  params: {
    teacherProfileId: string;
    from: string;
    to: string;
    durationMinutes: number;
  },
): Promise<TeacherAvailabilitySlotsResponse> {
  const query = new URLSearchParams();
  query.set("from", params.from);
  query.set("to", params.to);
  query.set("duration_minutes", String(params.durationMinutes));

  return backendRequest<TeacherAvailabilitySlotsResponse>({
    path: `/teachers/${params.teacherProfileId}/availability/slots?${query.toString()}`,
    accessToken,
  });
}
