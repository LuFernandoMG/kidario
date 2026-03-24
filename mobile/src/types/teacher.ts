import type { BackendProfileView, BackendProfileStatusResponse } from "@/types/profiles";
import type { BookingModality, BookingStatus, ObjectiveFulfilmentLevel } from "@/types/common";

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
  formations: TeacherFormationView[];
  experiences: TeacherExperienceView[];
  availability: TeacherAvailabilityView[];
}

export interface TeacherFormationView {
  id: string;
  degree_type: string;
  course_name: string;
  institution: string;
  completion_year?: string | null;
}

export interface TeacherExperienceView {
  id: string;
  institution: string;
  role: string;
  responsibilities: string;
  period_from: string;
  period_to?: string | null;
  current_position: boolean;
}

export interface TeacherAvailabilityView {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
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

export interface TeacherProfilePhotoUploadResponse extends BackendProfileStatusResponse {
  profile_photo_file_name: string;
}

export type TeacherProgressStatus = "sem_dados" | "atencao" | "consistente";

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

export interface TeacherStudentTimelineEntry {
  booking_id: string;
  child_id: string;
  child_name: string;
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

export interface TeacherChatThreadsResponse {
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
