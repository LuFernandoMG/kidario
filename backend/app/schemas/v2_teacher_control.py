from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel

from app.schemas.v2_bookings import BookingModality, BookingStatus, PaymentFlowStatus, TeacherDecisionStatus


class TeacherAgendaActionFlags(BaseModel):
    can_accept: bool
    can_reject: bool
    can_reschedule: bool
    can_open_chat: bool
    can_complete: bool


class TeacherLessonObjective(BaseModel):
    objective: str
    achieved: bool = False
    fullfilment_level: Literal[0, 1, 2, 3, 4, 5] = 0


class TeacherAgendaControlLesson(BaseModel):
    id: UUID
    child_id: UUID
    child_name: str
    parent_id: UUID
    starts_at: datetime
    duration_minutes: int
    modality: BookingModality
    status: BookingStatus
    teacher_decision_status: TeacherDecisionStatus
    teacher_decision_reason: str | None = None
    teacher_decision_at: datetime | None = None
    payment_flow_status: PaymentFlowStatus
    chat_thread_id: UUID | None = None
    has_unread_messages: bool = False
    completed_lessons_with_child: int
    objectives: list[TeacherLessonObjective]
    parent_focus_points: list[str]
    activity_plan_source: Literal["llm", "fallback"]
    activity_plan: list[str]
    actions: TeacherAgendaActionFlags


class TeacherChatPreview(BaseModel):
    thread_id: UUID
    booking_id: UUID
    booking_status: BookingStatus
    teacher_decision_status: TeacherDecisionStatus
    payment_flow_status: PaymentFlowStatus
    child_name: str
    parent_name: str
    lesson_starts_at: datetime
    last_message_at: datetime | None = None
    updated_at: datetime


class TeacherStudentOverview(BaseModel):
    child_id: UUID
    child_name: str
    child_birth_month_year: date | None = None
    total_lessons: int
    completed_lessons: int
    latest_lesson_at: datetime | None = None
    latest_follow_up_summary: str | None = None
    progress_status: Literal["sem_dados", "atencao", "consistente"]


class TeacherStudentTimelineFollowUp(BaseModel):
    updated_at: datetime
    summary: str
    next_steps: str
    objectives: list[TeacherLessonObjective]
    next_objectives: list[TeacherLessonObjective]
    tags: list[str]
    attention_points: list[str]


class TeacherStudentTimelineEntry(BaseModel):
    booking_id: UUID
    child_id: UUID
    child_name: str
    starts_at: datetime
    summary: str | None = None
    recent_objectives: list[TeacherLessonObjective]
    has_follow_up: bool
    follow_up: TeacherStudentTimelineFollowUp | None = None


class TeacherStudentTimelineResponse(BaseModel):
    child_id: UUID
    child_name: str
    total_completed_lessons: int
    timeline: list[TeacherStudentTimelineEntry]


class TeacherFinanceSummary(BaseModel):
    currency: str = "BRL"
    gross_revenue_total_cents: int
    paid_total_cents: int
    pending_payment_total_cents: int
    completed_lessons_count: int
    paid_lessons_count: int


class TeacherPlanningSummary(BaseModel):
    window_start: date
    window_end: date
    available_slots_count: int
    upcoming_lessons_count: int
    occupancy_rate_percent: float


class TeacherControlCenterOverviewResponse(BaseModel):
    generated_at: datetime
    upcoming_lessons_count: int
    pending_decisions_count: int
    agenda: list[TeacherAgendaControlLesson]
    chat_threads: list[TeacherChatPreview]
    students: list[TeacherStudentOverview]
    finance: TeacherFinanceSummary
    planning: TeacherPlanningSummary
