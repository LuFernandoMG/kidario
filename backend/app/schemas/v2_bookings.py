from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


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
PaymentChargeStatus = Literal[
    "pending",
    "processing",
    "paid",
    "payment_failed",
    "failed",
    "canceled",
    "refunded",
    "chargedback",
]


class PaymentCharge(BaseModel):
    id: UUID
    payment_order_id: UUID
    provider: str
    provider_charge_id: str | None = None
    provider_transaction_id: str | None = None
    payment_method: PaymentMethod
    status: PaymentChargeStatus
    amount_cents: int
    paid_amount_cents: int | None = None
    installments: int
    pix_qr_code_url: str | None = None
    boleto_url: str | None = None
    paid_at: datetime | None = None
    failed_at: datetime | None = None
    canceled_at: datetime | None = None
    refunded_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class PaymentOrder(BaseModel):
    id: UUID
    parent_id: UUID
    booking_id: UUID | None = None
    package_id: UUID | None = None
    provider: str
    provider_order_id: str | None = None
    provider_order_code: str | None = None
    amount_cents: int
    currency: str = "BRL"
    status: PaymentOrderStatus
    charges: list[PaymentCharge] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class PaymentOrdersResponse(BaseModel):
    payments: list[PaymentOrder]


class BookingChildSummary(BaseModel):
    id: UUID
    name: str


class BookingTeacherSummary(BaseModel):
    id: UUID
    display_name: str
    profile_photo_url: str | None = None


class BookingParentSummary(BaseModel):
    id: UUID
    display_name: str


class BookingActions(BaseModel):
    can_reschedule: bool
    can_cancel: bool
    can_complete: bool
    can_review: bool


class BookingObjectiveItem(BaseModel):
    objective: str
    achieved: bool = False
    fullfilment_level: int = Field(default=0, ge=0, le=5)


class BookingFollowUp(BaseModel):
    updated_at: datetime
    summary: str
    next_steps: str
    objectives: list[BookingObjectiveItem] = Field(default_factory=list)
    next_objectives: list[BookingObjectiveItem] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    attention_points: list[str] = Field(default_factory=list)


class Booking(BaseModel):
    id: UUID
    parent_id: UUID
    child_id: UUID
    teacher_id: UUID
    package_id: UUID | None = None
    starts_at: datetime
    duration_minutes: int
    modality: BookingModality
    status: BookingStatus
    cancellation_reason: str | None = None
    confirmed_at: datetime | None = None
    completed_at: datetime | None = None
    canceled_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    child: BookingChildSummary
    teacher: BookingTeacherSummary
    parent: BookingParentSummary | None = None
    payment_order: PaymentOrder | None = None
    latest_follow_up: BookingFollowUp | None = None
    actions: BookingActions


class BookingsResponse(BaseModel):
    bookings: list[Booking]


class BookingCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    child_id: UUID
    teacher_id: UUID
    starts_at: datetime
    duration_minutes: int | None = Field(default=None, ge=15, le=300)
    modality: BookingModality
    payment_method: PaymentMethod | None = None
    package_id: UUID | None = None

    @model_validator(mode="after")
    def require_payment_method_without_package(self) -> "BookingCreateRequest":
        if self.package_id is None and self.payment_method is None:
            raise ValueError("payment_method is required when package_id is not provided.")
        return self


class BookingRescheduleRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    starts_at: datetime
    reason: str | None = None


class BookingDecisionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    decision: Literal["accept", "reject"]
    reason: str | None = None


class BookingCancelRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reason: str | None = None


class BookingFollowUpPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    summary: str
    next_steps: str
    objectives: list[BookingObjectiveItem] = Field(default_factory=list)
    next_objectives: list[BookingObjectiveItem] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    attention_points: list[str] = Field(default_factory=list)


class BookingCompleteRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    follow_up: BookingFollowUpPayload


class EmptyRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    @model_validator(mode="after")
    def allow_empty_object(self) -> "EmptyRequest":
        return self
