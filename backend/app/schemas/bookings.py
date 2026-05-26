from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


BookingModality = Literal["online", "presencial"]
BookingStatus = Literal["pendente", "confirmada", "cancelada", "concluida"]
PaymentMethod = Literal["credit_card", "pix", "boleto"]
PaymentOrderStatus = Literal[
    "created",
    "pending",
    "paid",
    "payment_failed",
    "canceled",
    "refunded",
    "partially_refunded",
]


class PaymentOrderView(BaseModel):
    id: UUID
    amount_cents: int
    currency: str = "BRL"
    status: PaymentOrderStatus


class BookingCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    child_id: UUID
    teacher_id: UUID
    starts_at: datetime
    duration_minutes: int | None = Field(default=None, ge=15, le=300)
    modality: BookingModality
    payment_method: PaymentMethod
    package_id: UUID | None = None
    coupon_code: str | None = None


class BookingCreateResponse(BaseModel):
    status: str = "ok"
    booking_id: UUID
    booking_status: BookingStatus
    payment_order: PaymentOrderView


class ParentAgendaLesson(BaseModel):
    id: UUID
    parent_id: UUID
    teacher_id: UUID
    teacher_name: str
    teacher_avatar_url: str | None = None
    skill: str | None = None
    child_id: UUID
    child_name: str
    starts_at: datetime
    duration_minutes: int
    modality: BookingModality
    status: BookingStatus
    created_at: datetime
    updated_at: datetime


class ParentAgendaResponse(BaseModel):
    lessons: list[ParentAgendaLesson]


class TeacherAgendaLesson(BaseModel):
    id: UUID
    parent_id: UUID
    child_id: UUID
    child_name: str
    child_birth_month_year: date | None = None
    starts_at: datetime
    duration_minutes: int
    modality: BookingModality
    status: BookingStatus


class TeacherAgendaResponse(BaseModel):
    lessons: list[TeacherAgendaLesson]


class BookingObjectiveItem(BaseModel):
    objective: str
    achieved: bool = False
    fullfilment_level: int = Field(default=0, ge=0, le=5)


class BookingLatestFollowUp(BaseModel):
    updated_at: datetime
    summary: str
    next_steps: str
    objectives: list[BookingObjectiveItem] = Field(default_factory=list)
    next_objectives: list[BookingObjectiveItem] = Field(default_factory=list)
    tags: list[str]
    attention_points: list[str] = Field(default_factory=list)


class BookingActions(BaseModel):
    can_reschedule: bool
    can_cancel: bool
    can_complete: bool
    can_review: bool = False


class BookingDetailResponse(BaseModel):
    id: UUID
    parent_id: UUID
    child_id: UUID
    child_name: str
    teacher_id: UUID
    teacher_name: str
    teacher_avatar_url: str | None = None
    skill: str | None = None
    starts_at: datetime
    duration_minutes: int
    modality: BookingModality
    status: BookingStatus
    amount_cents: int
    currency: str
    payment_order: PaymentOrderView | None = None
    package_id: UUID | None = None
    cancellation_reason: str | None = None
    latest_follow_up: BookingLatestFollowUp | None = None
    actions: BookingActions


class BookingReschedulePatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    starts_at: datetime
    reason: str | None = None


class BookingRescheduleResponse(BaseModel):
    status: str = "ok"
    booking_id: UUID
    starts_at: datetime
    booking_status: BookingStatus
    updated_at: datetime


class TeacherBookingDecisionPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    action: Literal["accept", "reject"]
    reason: str | None = None


class TeacherBookingDecisionResponse(BaseModel):
    status: str = "ok"
    booking_id: UUID
    booking_status: BookingStatus
    updated_at: datetime
    cancellation_reason: str | None = None


class BookingCancelPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reason: str


class BookingCancelResponse(BaseModel):
    status: str = "ok"
    booking_id: UUID
    booking_status: BookingStatus
    cancellation_reason: str
    updated_at: datetime


class BookingFollowUpPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    summary: str
    next_steps: str
    objectives: list[BookingObjectiveItem] = Field(default_factory=list)
    next_objectives: list[BookingObjectiveItem] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    attention_points: list[str] = Field(default_factory=list)


class BookingCompletePatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    follow_up: BookingFollowUpPayload


class BookingCompleteResponse(BaseModel):
    status: str = "ok"
    booking_id: UUID
    booking_status: BookingStatus
    latest_follow_up: BookingLatestFollowUp


class TeacherFollowUpContextResponse(BaseModel):
    booking_id: UUID
    child_id: UUID
    child_name: str
    child_birth_month_year: date | None = None
    starts_at: datetime
    duration_minutes: int
    modality: BookingModality
    status: BookingStatus
    completed_lessons_with_child: int
    class_objectives: list[BookingObjectiveItem] = Field(default_factory=list)
    parent_focus_points: list[str] = Field(default_factory=list)
    activity_plan_source: Literal["llm", "fallback"]
    activity_plan: list[str] = Field(default_factory=list)


class TeacherAvailabilityDaySlots(BaseModel):
    date: date
    starts_at: list[datetime]


class TeacherAvailabilitySlotsResponse(BaseModel):
    teacher_id: UUID
    slots: list[TeacherAvailabilityDaySlots]
