from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


BookingModality = Literal["online", "presencial"]
BookingStatus = Literal["pendente", "confirmada", "cancelada", "concluida"]
PaymentMethod = Literal["cartao", "pix"]
PaymentStatus = Literal["pendente", "pago", "falhou"]


def _validate_hh_mm(value: str, field_name: str) -> str:
    if len(value) != 5 or value[2] != ":":
        raise ValueError(f"{field_name} must have format HH:mm.")

    hours_part, minutes_part = value.split(":", maxsplit=1)
    if not hours_part.isdigit() or not minutes_part.isdigit():
        raise ValueError(f"{field_name} must have format HH:mm.")

    hours = int(hours_part)
    minutes = int(minutes_part)
    if hours < 0 or hours > 23 or minutes < 0 or minutes > 59:
        raise ValueError(f"{field_name} must have format HH:mm.")
    return value


class BookingCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    parent_profile_id: UUID | None = None
    child_id: UUID | None = None
    teacher_profile_id: UUID
    date_iso: date
    time: str
    duration_minutes: int = Field(ge=15, le=300)
    modality: BookingModality
    payment_method: PaymentMethod
    coupon_code: str | None = None

    @field_validator("time")
    @classmethod
    def validate_time(cls, value: str) -> str:
        return _validate_hh_mm(value, "time")


class BookingCreateResponse(BaseModel):
    status: str = "ok"
    booking_id: UUID
    booking_status: BookingStatus
    payment_status: PaymentStatus


class ParentAgendaLesson(BaseModel):
    id: UUID
    teacher_id: UUID
    teacher_name: str
    teacher_avatar_url: str | None = None
    specialty: str | None = None
    child_id: UUID
    child_name: str
    date_iso: date
    date_label: str
    time: str
    modality: BookingModality
    status: BookingStatus
    created_at_iso: datetime
    updated_at_iso: datetime


class ParentAgendaResponse(BaseModel):
    lessons: list[ParentAgendaLesson]


class TeacherAgendaLesson(BaseModel):
    id: UUID
    parent_profile_id: UUID
    child_id: UUID
    child_name: str
    child_age: int | None = None
    date_iso: date
    time: str
    duration_minutes: int
    modality: BookingModality
    status: BookingStatus


class TeacherAgendaResponse(BaseModel):
    lessons: list[TeacherAgendaLesson]


class BookingLatestFollowUp(BaseModel):
    updated_at: datetime
    summary: str
    next_steps: str
    tags: list[str]
    attention_points: list[str] = Field(default_factory=list)


class BookingActions(BaseModel):
    can_reschedule: bool
    can_cancel: bool
    can_complete: bool


class BookingDetailResponse(BaseModel):
    id: UUID
    parent_profile_id: UUID
    child_id: UUID
    child_name: str
    teacher_id: UUID
    teacher_name: str
    teacher_avatar_url: str | None = None
    specialty: str | None = None
    date_iso: date
    date_label: str
    time: str
    duration_minutes: int
    modality: BookingModality
    status: BookingStatus
    price_total: float
    currency: str
    cancellation_reason: str | None = None
    latest_follow_up: BookingLatestFollowUp | None = None
    actions: BookingActions


class BookingReschedulePatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    new_date_iso: date
    new_time: str
    reason: str | None = None

    @field_validator("new_time")
    @classmethod
    def validate_new_time(cls, value: str) -> str:
        return _validate_hh_mm(value, "new_time")


class BookingRescheduleResponse(BaseModel):
    status: str = "ok"
    booking_id: UUID
    date_iso: date
    time: str
    booking_status: BookingStatus
    updated_at_iso: datetime


class BookingCancelPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reason: str


class BookingCancelResponse(BaseModel):
    status: str = "ok"
    booking_id: UUID
    booking_status: BookingStatus
    cancellation_reason: str
    updated_at_iso: datetime


class BookingFollowUpPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    summary: str
    next_steps: str
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


class TeacherAvailabilityDaySlots(BaseModel):
    date_iso: date
    date_label: str
    times: list[str]


class TeacherAvailabilitySlotsResponse(BaseModel):
    teacher_profile_id: UUID
    slots: list[TeacherAvailabilityDaySlots]
