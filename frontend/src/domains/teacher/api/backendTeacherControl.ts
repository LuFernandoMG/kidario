import { getBackendApiBaseUrl, resolveProtectedAccessToken, throwBackendError } from "@/lib/backendApi";
import { buildRequestIdHeader } from "@/lib/observability";

export type BookingStatus = "pendente" | "confirmada" | "cancelada" | "concluida";
export type BookingModality = "online" | "presencial";
export type TeacherProgressStatus = "sem_dados" | "atencao" | "consistente";
export type ObjectiveFulfilmentLevel = 0 | 1 | 2 | 3 | 4 | 5;

export interface LessonObjectiveItem {
  objective: string;
  achieved: boolean;
  fullfilment_level: ObjectiveFulfilmentLevel;
}

export interface TeacherAgendaControlLesson {
  id: string;
  child_id: string;
  child_name: string;
  parent_profile_id: string;
  date_iso: string;
  date_label: string;
  time: string;
  duration_minutes: number;
  modality: BookingModality;
  status: BookingStatus;
  chat_thread_id?: string | null;
  has_unread_messages: boolean;
  completed_lessons_with_child: number;
  objectives: LessonObjectiveItem[];
  parent_focus_points: string[];
  activity_plan_source: "llm" | "fallback";
  activity_plan: string[];
  actions: {
    can_accept: boolean;
    can_reject: boolean;
    can_reschedule: boolean;
    can_open_chat: boolean;
    can_complete: boolean;
  };
}

export interface TeacherChatPreview {
  thread_id: string;
  booking_id: string;
  booking_status: BookingStatus;
  child_name: string;
  parent_name: string;
  lesson_date_iso: string;
  lesson_time: string;
  last_message_at?: string | null;
  updated_at: string;
}

export interface TeacherStudentOverview {
  child_id: string;
  child_name: string;
  child_age?: number | null;
  total_lessons: number;
  completed_lessons: number;
  latest_lesson_date?: string | null;
  latest_follow_up_summary?: string | null;
  progress_status: TeacherProgressStatus;
}

export interface TeacherControlCenterOverviewResponse {
  generated_at: string;
  upcoming_lessons_count: number;
  pending_decisions_count: number;
  agenda: TeacherAgendaControlLesson[];
  chat_threads: TeacherChatPreview[];
  students: TeacherStudentOverview[];
  finance: {
    currency: string;
    gross_revenue_total: number;
    paid_total: number;
    pending_payment_total: number;
    completed_lessons_count: number;
    paid_lessons_count: number;
  };
  planning: {
    window_start: string;
    window_end: string;
    available_slots_count: number;
    upcoming_lessons_count: number;
    occupancy_rate_percent: number;
  };
}

export interface TeacherBookingDecisionPayload {
  action: "accept" | "reject";
  reason?: string;
}

export interface TeacherBookingDecisionResponse {
  status: "ok";
  booking_id: string;
  booking_status: BookingStatus;
  updated_at_iso: string;
  cancellation_reason?: string | null;
}

export interface TeacherBookingReschedulePayload {
  new_date_iso: string;
  new_time: string;
  reason?: string;
}

export interface TeacherBookingRescheduleResponse {
  status: "ok";
  booking_id: string;
  date_iso: string;
  time: string;
  booking_status: BookingStatus;
  updated_at_iso: string;
}

export interface ChatThreadsResponse {
  threads: {
    id: string;
    booking_id: string;
    parent_profile_id: string;
    teacher_profile_id: string;
    child_id: string;
    booking_status: BookingStatus;
    parent_name: string;
    teacher_name: string;
    child_name: string;
    created_at: string;
    updated_at: string;
    last_message_at?: string | null;
  }[];
}

async function teacherRequest<TResponse>(params: {
  path: string;
  accessToken: string;
  method?: "GET" | "PATCH";
  body?: Record<string, unknown>;
  fallback: string;
}): Promise<TResponse> {
  const { path, accessToken, method = "GET", body, fallback } = params;
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
      fallback,
      authProtected: true,
    });
  }
  return payload as TResponse;
}

function normalizeLimit(value: number | undefined, fallback: number) {
  const raw = Number.isFinite(value) ? Number(value) : fallback;
  return Math.min(30, Math.max(1, raw));
}

export async function getTeacherControlCenterOverview(
  accessToken: string,
  params: {
    limitAgenda?: number;
    limitChats?: number;
    limitStudents?: number;
    includeHistory?: boolean;
  } = {},
): Promise<TeacherControlCenterOverviewResponse> {
  const normalizeAgendaLimit = (value: number | undefined) => {
    const raw = Number.isFinite(value) ? Number(value) : 8;
    return Math.min(200, Math.max(1, raw));
  };
  const query = new URLSearchParams();
  query.set("limit_agenda", String(normalizeAgendaLimit(params.limitAgenda)));
  query.set("limit_chats", String(normalizeLimit(params.limitChats, 8)));
  query.set("limit_students", String(normalizeLimit(params.limitStudents, 8)));
  if (params.includeHistory) {
    query.set("include_history", "true");
  }

  return teacherRequest<TeacherControlCenterOverviewResponse>({
    path: `/teacher/control-center/overview?${query.toString()}`,
    accessToken,
    fallback: "Não foi possível carregar o centro de controle da professora.",
  });
}

export async function decideTeacherBooking(
  accessToken: string,
  bookingId: string,
  payload: TeacherBookingDecisionPayload,
): Promise<TeacherBookingDecisionResponse> {
  return teacherRequest<TeacherBookingDecisionResponse>({
    path: `/bookings/${bookingId}/teacher/decision`,
    accessToken,
    method: "PATCH",
    body: payload as Record<string, unknown>,
    fallback: "Não foi possível atualizar o status da aula.",
  });
}

export async function rescheduleTeacherBooking(
  accessToken: string,
  bookingId: string,
  payload: TeacherBookingReschedulePayload,
): Promise<TeacherBookingRescheduleResponse> {
  return teacherRequest<TeacherBookingRescheduleResponse>({
    path: `/bookings/${bookingId}/teacher/reschedule`,
    accessToken,
    method: "PATCH",
    body: payload as Record<string, unknown>,
    fallback: "Não foi possível reagendar a aula.",
  });
}

export async function getTeacherChatThreads(
  accessToken: string,
  params: {
    status?: BookingStatus;
    limit?: number;
  } = {},
): Promise<ChatThreadsResponse> {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  query.set("limit", String(params.limit ?? 30));

  return teacherRequest<ChatThreadsResponse>({
    path: `/chat/threads?${query.toString()}`,
    accessToken,
    fallback: "Não foi possível carregar as conversas da professora.",
  });
}
