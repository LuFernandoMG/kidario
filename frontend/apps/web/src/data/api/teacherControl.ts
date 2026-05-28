import { getBackendApiBaseUrl, resolveProtectedAccessToken, throwBackendError } from "@/lib/backendApi";
import { formatDateLong, toDateIso } from "@/lib/bookingUtils";
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
  parent_id: string;
  parent_profile_id: string;
  starts_at: string;
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
  lesson_starts_at: string;
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
  latest_lesson_at?: string | null;
  latest_lesson_date?: string | null;
  latest_follow_up_summary?: string | null;
  progress_status: TeacherProgressStatus;
}

export interface TeacherStudentTimelineEntry {
  booking_id: string;
  child_id: string;
  child_name: string;
  starts_at: string;
  date_iso: string;
  date_label: string;
  time: string;
  summary?: string | null;
  recent_objectives: LessonObjectiveItem[];
  has_follow_up: boolean;
  follow_up?: {
    updated_at: string;
    summary: string;
    next_steps: string;
    objectives: LessonObjectiveItem[];
    next_objectives: LessonObjectiveItem[];
    tags: string[];
    attention_points: string[];
  } | null;
}

export interface TeacherStudentTimelineResponse {
  child_id: string;
  child_name: string;
  total_completed_lessons: number;
  timeline: TeacherStudentTimelineEntry[];
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
    gross_revenue_total_cents: number;
    paid_total_cents: number;
    pending_payment_total_cents: number;
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
    parent_id: string;
    teacher_id: string;
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
  method?: "GET" | "PATCH" | "POST";
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

function deriveDateParts(startsAt: string) {
  const date = new Date(startsAt);
  if (Number.isNaN(date.getTime())) {
    const dateIso = startsAt.slice(0, 10);
    return { dateIso, dateLabel: formatDateLong(dateIso), time: "" };
  }
  const dateIso = toDateIso(date);
  return {
    dateIso,
    dateLabel: formatDateLong(dateIso),
    time: date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
  };
}

function composeStartsAt(dateIso: string, time: string) {
  const [year, month, day] = dateIso.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  const date = new Date(year, (month || 1) - 1, day || 1, hours || 0, minutes || 0, 0, 0);
  return date.toISOString();
}

function mapOverviewResponse(response: TeacherControlCenterOverviewResponse): TeacherControlCenterOverviewResponse {
  return {
    ...response,
    agenda: (response.agenda || []).map((lesson) => {
      const parts = deriveDateParts(lesson.starts_at);
      return {
        ...lesson,
        parent_profile_id: lesson.parent_profile_id || lesson.parent_id,
        date_iso: lesson.date_iso || parts.dateIso,
        date_label: lesson.date_label || parts.dateLabel,
        time: lesson.time || parts.time,
      };
    }),
    chat_threads: (response.chat_threads || []).map((thread) => {
      const parts = deriveDateParts(thread.lesson_starts_at);
      return {
        ...thread,
        lesson_date_iso: thread.lesson_date_iso || parts.dateIso,
        lesson_time: thread.lesson_time || parts.time,
      };
    }),
    students: (response.students || []).map((student) => ({
      ...student,
      latest_lesson_date: student.latest_lesson_date || student.latest_lesson_at || null,
    })),
    finance: {
      ...response.finance,
      gross_revenue_total: response.finance.gross_revenue_total ?? (response.finance.gross_revenue_total_cents || 0) / 100,
      paid_total: response.finance.paid_total ?? (response.finance.paid_total_cents || 0) / 100,
      pending_payment_total:
        response.finance.pending_payment_total ?? (response.finance.pending_payment_total_cents || 0) / 100,
    },
  };
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

  const response = await teacherRequest<TeacherControlCenterOverviewResponse>({
    path: `/teacher/control-center/overview?${query.toString()}`,
    accessToken,
    fallback: "Não foi possível carregar o centro de controle da professora.",
  });
  return mapOverviewResponse(response);
}

export async function decideTeacherBooking(
  accessToken: string,
  bookingId: string,
  payload: TeacherBookingDecisionPayload,
): Promise<TeacherBookingDecisionResponse> {
  const response = await teacherRequest<{ id: string; status: BookingStatus; updated_at: string; cancellation_reason?: string | null }>({
    path: `/bookings/${bookingId}/decision`,
    accessToken,
    method: "POST",
    body: {
      decision: payload.action === "accept" ? "accept" : "reject",
      reason: payload.reason,
    },
    fallback: "Não foi possível atualizar o status da aula.",
  });
  return {
    status: "ok",
    booking_id: response.id,
    booking_status: response.status,
    updated_at_iso: response.updated_at,
    cancellation_reason: response.cancellation_reason,
  };
}

export async function rescheduleTeacherBooking(
  accessToken: string,
  bookingId: string,
  payload: TeacherBookingReschedulePayload,
): Promise<TeacherBookingRescheduleResponse> {
  const response = await teacherRequest<{ id: string; starts_at: string; status: BookingStatus; updated_at: string }>({
    path: `/bookings/${bookingId}/teacher/reschedule`,
    accessToken,
    method: "PATCH",
    body: {
      starts_at: composeStartsAt(payload.new_date_iso, payload.new_time),
      reason: payload.reason,
    },
    fallback: "Não foi possível reagendar a aula.",
  });
  const parts = deriveDateParts(response.starts_at);
  return {
    status: "ok",
    booking_id: response.id,
    date_iso: parts.dateIso,
    time: parts.time,
    booking_status: response.status,
    updated_at_iso: response.updated_at,
  };
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

export async function getTeacherStudentTimeline(
  accessToken: string,
  childId: string,
  params: { limit?: number } = {},
): Promise<TeacherStudentTimelineResponse> {
  const query = new URLSearchParams();
  const rawLimit = Number.isFinite(params.limit) ? Number(params.limit) : 50;
  query.set("limit", String(Math.min(200, Math.max(1, rawLimit))));

  const response = await teacherRequest<TeacherStudentTimelineResponse>({
    path: `/teacher/students/${childId}/timeline?${query.toString()}`,
    accessToken,
    fallback: "Não foi possível carregar a linha do tempo do aluno.",
  });
  return {
    ...response,
    timeline: (response.timeline || []).map((entry) => {
      const parts = deriveDateParts(entry.starts_at);
      return {
        ...entry,
        date_iso: entry.date_iso || parts.dateIso,
        date_label: entry.date_label || parts.dateLabel,
        time: entry.time || parts.time,
      };
    }),
  };
}
