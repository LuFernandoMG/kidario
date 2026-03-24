import type {
  BookingModality,
  BookingStatus,
  ObjectiveFulfilmentLevel,
  PaymentMethod,
  PaymentStatus,
} from "@/types/common";

export interface LessonObjectiveItem {
  objective: string;
  achieved: boolean;
  fullfilment_level: ObjectiveFulfilmentLevel;
}

export interface CreateBookingPayload {
  parent_profile_id?: string;
  child_id?: string;
  teacher_profile_id: string;
  date_iso: string;
  time: string;
  duration_minutes: number;
  modality: BookingModality;
  payment_method: PaymentMethod;
  coupon_code?: string;
}

export interface CreateBookingResponse {
  status: "ok";
  booking_id: string;
  booking_status: BookingStatus;
  payment_status: PaymentStatus;
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
  objectives: LessonObjectiveItem[];
  next_objectives: LessonObjectiveItem[];
  tags: string[];
  attention_points: string[];
}

export interface TeacherFollowUpContextResponse {
  booking_id: string;
  child_id: string;
  child_name: string;
  child_age?: number | null;
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

export interface CompleteBookingPayload {
  follow_up: {
    summary: string;
    next_steps: string;
    objectives: LessonObjectiveItem[];
    next_objectives: LessonObjectiveItem[];
    tags: string[];
    attention_points: string[];
  };
}

export interface CompleteBookingResponse {
  status: "ok";
  booking_id: string;
  booking_status: BookingStatus;
  latest_follow_up: BookingDetailFollowUp;
}
