import { backendJsonRequest } from "@/lib/backendApi";
import { formatDateLong, formatRelativeDateLabel, toDateIso } from "@/lib/bookingUtils";

export type BookingStatus = "pendente" | "confirmada" | "cancelada" | "concluida";
export type BookingModality = "online" | "presencial";
export type PaymentMethod = "credit_card" | "pix" | "boleto";
export type TeacherDecisionStatus = "pending" | "accepted" | "rejected";
export type PaymentFlowStatus =
  | "not_started"
  | "authorization_required"
  | "authorized"
  | "awaiting_payment"
  | "paid"
  | "failed"
  | "expired"
  | "refunded";
export type ObjectiveFulfilmentLevel = 0 | 1 | 2 | 3 | 4 | 5;

export interface LessonObjectiveItem {
  objective: string;
  achieved: boolean;
  fullfilment_level: ObjectiveFulfilmentLevel;
}

export interface PaymentCharge {
  id: string;
  payment_order_id: string;
  provider: string;
  provider_charge_id?: string | null;
  provider_transaction_id?: string | null;
  payment_method: PaymentMethod;
  status: string;
  amount_cents: number;
  paid_amount_cents?: number | null;
  installments: number;
  pix_qr_code_url?: string | null;
  pix_qr_code?: string | null;
  boleto_url?: string | null;
  card_brand?: string | null;
  card_last_four?: string | null;
  card_holder_name?: string | null;
  authorization_code?: string | null;
  authorized_at?: string | null;
  captured_at?: string | null;
  expires_at?: string | null;
  payment_url?: string | null;
  boleto_barcode?: string | null;
  boleto_line?: string | null;
  paid_at?: string | null;
  failed_at?: string | null;
  canceled_at?: string | null;
  refunded_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentOrder {
  id: string;
  parent_id: string;
  booking_id?: string | null;
  package_id?: string | null;
  provider: string;
  provider_order_id?: string | null;
  provider_order_code?: string | null;
  requested_payment_method?: PaymentMethod | null;
  amount_cents: number;
  currency: string;
  status: string;
  authorized_at?: string | null;
  paid_at?: string | null;
  expires_at?: string | null;
  charges: PaymentCharge[];
  created_at: string;
  updated_at: string;
}

export interface BookingResponse {
  id: string;
  parent_id: string;
  child_id: string;
  teacher_id: string;
  package_id?: string | null;
  starts_at: string;
  duration_minutes: number;
  modality: BookingModality;
  status: BookingStatus;
  teacher_decision_status?: TeacherDecisionStatus;
  teacher_decision_reason?: string | null;
  teacher_decision_at?: string | null;
  payment_flow_status?: PaymentFlowStatus;
  cancellation_reason?: string | null;
  confirmed_at?: string | null;
  completed_at?: string | null;
  canceled_at?: string | null;
  created_at: string;
  updated_at: string;
  child: {
    id: string;
    name: string;
  };
  teacher: {
    id: string;
    display_name: string;
    profile_photo_url?: string | null;
  };
  parent?: {
    id: string;
    display_name: string;
  } | null;
  payment_order?: PaymentOrder | null;
  latest_follow_up?: BookingDetailFollowUp | null;
  actions: {
    can_reschedule: boolean;
    can_cancel: boolean;
    can_complete: boolean;
    can_review: boolean;
  };
}

export interface CreateBookingPayload {
  child_id: string;
  teacher_id: string;
  starts_at: string;
  duration_minutes: number;
  modality: BookingModality;
  payment_method?: PaymentMethod;
  package_id?: string;
  card_token?: string;
  card_id?: string;
  installments?: number;
}

export interface CreateBookingResponse {
  status: "ok";
  booking_id: string;
  booking_status: BookingStatus;
  payment_status: string;
  booking: BookingDetailResponse;
}

export interface RetryBookingPaymentPayload {
  payment_method: PaymentMethod;
  card_token?: string;
  card_id?: string;
  installments?: number;
}

export interface ParentAgendaLesson {
  id: string;
  teacher_id: string;
  teacher_name: string;
  teacher_avatar_url?: string | null;
  specialty?: string | null;
  child_id: string;
  child_name: string;
  starts_at: string;
  date_iso: string;
  date_label: string;
  time: string;
  modality: BookingModality;
  status: BookingStatus;
  teacher_decision_status: TeacherDecisionStatus;
  payment_flow_status: PaymentFlowStatus;
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
  objectives: LessonObjectiveItem[];
  next_objectives: LessonObjectiveItem[];
  tags: string[];
  attention_points: string[];
}

export interface TeacherFollowUpContextResponse {
  booking_id: string;
  child_id: string;
  child_name: string;
  child_birth_month_year?: string | null;
  starts_at: string;
  date_iso: string;
  date_label: string;
  time: string;
  duration_minutes: number;
  modality: BookingModality;
  status: BookingStatus;
  completed_lessons_with_child: number;
  class_objectives: LessonObjectiveItem[];
  parent_focus_points: string[];
  activity_plan_source: "llm" | "fallback";
  activity_plan: string[];
}

export interface BookingDetailResponse extends BookingResponse {
  parent_profile_id: string;
  child_name: string;
  teacher_name: string;
  teacher_avatar_url?: string | null;
  specialty?: string | null;
  date_iso: string;
  date_label: string;
  time: string;
  price_total: number;
  currency: string;
}

export interface RescheduleBookingPayload {
  starts_at?: string;
  new_date_iso?: string;
  new_time?: string;
  reason?: string;
}

export interface RescheduleBookingResponse {
  status: "ok";
  booking_id: string;
  starts_at: string;
  date_iso: string;
  time: string;
  booking_status: BookingStatus;
  updated_at_iso: string;
}

export interface CancelBookingPayload {
  reason?: string;
}

export interface CancelBookingResponse {
  status: "ok";
  booking_id: string;
  booking_status: BookingStatus;
  cancellation_reason?: string | null;
  updated_at_iso: string;
}

export interface TeacherAvailabilityDay {
  date_iso: string;
  date_label: string;
  times: string[];
}

export interface TeacherAvailabilitySlotsResponse {
  teacher_id: string;
  teacher_profile_id: string;
  slots: TeacherAvailabilityDay[];
}

interface RawTeacherAvailabilityDay {
  date?: string;
  starts_at?: string[];
  date_iso?: string;
  date_label?: string;
  times?: string[];
}

interface RawTeacherAvailabilitySlotsResponse {
  teacher_id: string;
  teacher_profile_id?: string;
  slots?: RawTeacherAvailabilityDay[];
}

async function backendRequest<TResponse>(params: {
  path: string;
  accessToken: string;
  method?: "GET" | "PATCH" | "POST";
  body?: Record<string, unknown>;
}): Promise<TResponse> {
  const { path, accessToken, method = "GET", body } = params;
  return backendJsonRequest<TResponse>({
    path,
    accessToken,
    method,
    body,
    fallback: "Não foi possível processar a operação no backend.",
    authProtected: true,
  });
}

function formatTimeFromIso(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function composeStartsAt(dateIso: string, time: string) {
  const [year, month, day] = dateIso.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  const date = new Date(year, (month || 1) - 1, day || 1, hours || 0, minutes || 0, 0, 0);
  return date.toISOString();
}

function normalizeClockTime(value: string) {
  const trimmed = value.trim();
  const timeOnlyMatch = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/);
  if (timeOnlyMatch) {
    return `${timeOnlyMatch[1].padStart(2, "0")}:${timeOnlyMatch[2]}`;
  }

  const isoTimeMatch = trimmed.match(/T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?/);
  if (isoTimeMatch) {
    return `${isoTimeMatch[1]}:${isoTimeMatch[2]}`;
  }

  return formatTimeFromIso(trimmed);
}

function formatAvailabilityDateLabel(dateIso: string) {
  const [year, month, day] = dateIso.split("-").map(Number);
  const date = new Date(year, (month || 1) - 1, day || 1);
  if (Number.isNaN(date.getTime())) return dateIso;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dateStart = new Date(date);
  dateStart.setHours(0, 0, 0, 0);
  const dayOffset = Math.round((dateStart.getTime() - today.getTime()) / 86_400_000);
  return formatRelativeDateLabel(date, dayOffset);
}

function normalizeDateLabel(value: string) {
  if (!value) return value;
  return `${value.charAt(0).toLocaleUpperCase("pt-BR")}${value.slice(1)}`;
}

function normalizeAvailabilityDay(raw: RawTeacherAvailabilityDay): TeacherAvailabilityDay | null {
  const startsAtValues = Array.isArray(raw.starts_at) ? raw.starts_at : [];
  const dateIso = raw.date_iso || raw.date || startsAtValues[0]?.slice(0, 10);
  if (!dateIso) return null;

  const rawTimes = Array.isArray(raw.times) ? raw.times : startsAtValues;
  const times = Array.from(
    new Set(
      rawTimes
        .map((time) => normalizeClockTime(time))
        .filter((time): time is string => Boolean(time)),
    ),
  );

  return {
    date_iso: dateIso,
    date_label: normalizeDateLabel(raw.date_label || formatAvailabilityDateLabel(dateIso)),
    times,
  };
}

function mapBooking(raw: BookingResponse): BookingDetailResponse {
  const startsAtDate = new Date(raw.starts_at);
  const dateIso = Number.isNaN(startsAtDate.getTime()) ? raw.starts_at.slice(0, 10) : toDateIso(startsAtDate);
  const time = formatTimeFromIso(raw.starts_at);
  const amountCents = raw.payment_order?.amount_cents ?? 0;

  return {
    ...raw,
    teacher_decision_status: raw.teacher_decision_status || "pending",
    payment_flow_status: raw.payment_flow_status || "not_started",
    parent_profile_id: raw.parent_id,
    child_name: raw.child?.name || "Aluno",
    teacher_name: raw.teacher?.display_name || "Professora",
    teacher_avatar_url: raw.teacher?.profile_photo_url,
    specialty: null,
    date_iso: dateIso,
    date_label: formatDateLong(dateIso),
    time,
    price_total: amountCents / 100,
    currency: raw.payment_order?.currency || "BRL",
  };
}

function mapAgendaLesson(raw: BookingResponse): ParentAgendaLesson {
  const detail = mapBooking(raw);
  return {
    id: detail.id,
    teacher_id: detail.teacher_id,
    teacher_name: detail.teacher_name,
    teacher_avatar_url: detail.teacher_avatar_url,
    specialty: detail.specialty,
    child_id: detail.child_id,
    child_name: detail.child_name,
    starts_at: detail.starts_at,
    date_iso: detail.date_iso,
    date_label: detail.date_label,
    time: detail.time,
    modality: detail.modality,
    status: detail.status,
    teacher_decision_status: detail.teacher_decision_status || "pending",
    payment_flow_status: detail.payment_flow_status || "not_started",
    created_at_iso: detail.created_at,
    updated_at_iso: detail.updated_at,
  };
}

export async function createBooking(
  accessToken: string,
  payload: CreateBookingPayload,
): Promise<CreateBookingResponse> {
  const booking = mapBooking(
    await backendRequest<BookingResponse>({
      path: "/bookings",
      accessToken,
      method: "POST",
      body: payload as unknown as Record<string, unknown>,
    }),
  );
  return {
    status: "ok",
    booking_id: booking.id,
    booking_status: booking.status,
    payment_status: booking.payment_order?.status || "created",
    booking,
  };
}

export async function retryBookingPayment(
  accessToken: string,
  bookingId: string,
  payload: RetryBookingPaymentPayload,
): Promise<CreateBookingResponse> {
  const booking = mapBooking(
    await backendRequest<BookingResponse>({
      path: `/bookings/${bookingId}/payment/retry`,
      accessToken,
      method: "POST",
      body: payload as unknown as Record<string, unknown>,
    }),
  );
  return {
    status: "ok",
    booking_id: booking.id,
    booking_status: booking.status,
    payment_status: booking.payment_order?.status || "created",
    booking,
  };
}

export async function getParentAgenda(
  accessToken: string,
  params: { tab: "upcoming" | "past"; childId?: string },
): Promise<ParentAgendaResponse> {
  const query = new URLSearchParams();
  query.set("tab", params.tab);
  if (params.childId) query.set("child_id", params.childId);

  const response = await backendRequest<{ bookings: BookingResponse[] }>({
    path: `/parents/me/bookings?${query.toString()}`,
    accessToken,
  });
  return { lessons: response.bookings.map(mapAgendaLesson) };
}

export async function getBookingDetail(
  accessToken: string,
  bookingId: string,
): Promise<BookingDetailResponse> {
  return mapBooking(
    await backendRequest<BookingResponse>({
      path: `/bookings/${bookingId}`,
      accessToken,
    }),
  );
}

export async function getTeacherFollowUpContext(
  accessToken: string,
  bookingId: string,
): Promise<TeacherFollowUpContextResponse> {
  const response = await backendRequest<TeacherFollowUpContextResponse>({
    path: `/bookings/${bookingId}/teacher/follow-up-context`,
    accessToken,
  });
  const startsAtDate = new Date(response.starts_at);
  const dateIso = Number.isNaN(startsAtDate.getTime()) ? response.starts_at.slice(0, 10) : toDateIso(startsAtDate);

  return {
    ...response,
    date_iso: response.date_iso || dateIso,
    date_label: response.date_label || formatDateLong(dateIso),
    time: response.time || formatTimeFromIso(response.starts_at),
  };
}

export async function completeBooking(
  accessToken: string,
  bookingId: string,
  payload: {
    follow_up: {
      summary: string;
      next_steps: string;
      objectives: LessonObjectiveItem[];
      next_objectives: LessonObjectiveItem[];
      tags: string[];
      attention_points: string[];
    };
  },
) {
  const booking = mapBooking(
    await backendRequest<BookingResponse>({
      path: `/bookings/${bookingId}/complete`,
      accessToken,
      method: "POST",
      body: payload as unknown as Record<string, unknown>,
    }),
  );
  return {
    status: "ok" as const,
    booking_id: booking.id,
    booking_status: booking.status,
    latest_follow_up: booking.latest_follow_up,
  };
}

export async function rescheduleBooking(
  accessToken: string,
  bookingId: string,
  payload: RescheduleBookingPayload,
): Promise<RescheduleBookingResponse> {
  const startsAt = payload.starts_at || (
    payload.new_date_iso && payload.new_time ? composeStartsAt(payload.new_date_iso, payload.new_time) : ""
  );
  const booking = mapBooking(
    await backendRequest<BookingResponse>({
      path: `/bookings/${bookingId}/reschedule`,
      accessToken,
      method: "PATCH",
      body: {
        starts_at: startsAt,
        reason: payload.reason,
      },
    }),
  );
  return {
    status: "ok",
    booking_id: booking.id,
    starts_at: booking.starts_at,
    date_iso: booking.date_iso,
    time: booking.time,
    booking_status: booking.status,
    updated_at_iso: booking.updated_at,
  };
}

export async function cancelBooking(
  accessToken: string,
  bookingId: string,
  payload: CancelBookingPayload,
): Promise<CancelBookingResponse> {
  const booking = mapBooking(
    await backendRequest<BookingResponse>({
      path: `/bookings/${bookingId}/cancel`,
      accessToken,
      method: "POST",
      body: payload as unknown as Record<string, unknown>,
    }),
  );
  return {
    status: "ok",
    booking_id: booking.id,
    booking_status: booking.status,
    cancellation_reason: booking.cancellation_reason,
    updated_at_iso: booking.updated_at,
  };
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

  const response = await backendRequest<RawTeacherAvailabilitySlotsResponse>({
    path: `/teachers/${params.teacherProfileId}/availability/slots?${query.toString()}`,
    accessToken,
  });

  return {
    teacher_id: response.teacher_id,
    teacher_profile_id: response.teacher_profile_id || response.teacher_id,
    slots: (response.slots || [])
      .map((slot) => normalizeAvailabilityDay(slot))
      .filter((slot): slot is TeacherAvailabilityDay => Boolean(slot)),
  };
}
