from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


BookingModality = Literal["online", "presencial"]
BookingStatus = Literal["pendente", "confirmada", "cancelada", "concluida"]
TeacherDecisionStatus = Literal["pending", "accepted", "rejected"]
PaymentFlowStatus = Literal[
    "not_started",
    "authorization_required",
    "authorized",
    "awaiting_payment",
    "paid",
    "failed",
    "expired",
    "refunded",
]
PaymentMethod = Literal["credit_card", "pix", "boleto"]
PaymentOrderStatus = Literal[
    "created",
    "pending",
    "authorized",
    "paid",
    "payment_failed",
    "canceled",
    "expired",
    "refunded",
    "partially_refunded",
]
PaymentChargeStatus = Literal[
    "pending",
    "processing",
    "authorized",
    "waiting_capture",
    "paid",
    "payment_failed",
    "failed",
    "canceled",
    "expired",
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
    pix_qr_code: str | None = None
    pix_qr_code_url: str | None = None
    boleto_url: str | None = None
    card_brand: str | None = None
    card_last_four: str | None = None
    card_holder_name: str | None = None
    authorization_code: str | None = None
    authorized_at: datetime | None = None
    captured_at: datetime | None = None
    expires_at: datetime | None = None
    payment_url: str | None = None
    boleto_barcode: str | None = None
    boleto_line: str | None = None
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
    requested_payment_method: PaymentMethod | None = None
    amount_cents: int
    currency: str = "BRL"
    status: PaymentOrderStatus
    authorized_at: datetime | None = None
    paid_at: datetime | None = None
    expires_at: datetime | None = None
    charges: list[PaymentCharge] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class PaymentOrdersResponse(BaseModel):
    payments: list[PaymentOrder]


class TeacherAvailabilitySlotDay(BaseModel):
    date_iso: str
    date_label: str
    times: list[str] = Field(default_factory=list)


class TeacherAvailabilitySlotsResponse(BaseModel):
    teacher_id: UUID
    teacher_profile_id: UUID
    slots: list[TeacherAvailabilitySlotDay] = Field(default_factory=list)


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
    teacher_decision_status: TeacherDecisionStatus = "pending"
    teacher_decision_reason: str | None = None
    teacher_decision_at: datetime | None = None
    payment_flow_status: PaymentFlowStatus = "not_started"
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
    card_token: str | None = None
    card_id: str | None = None
    installments: int = Field(default=1, ge=1, le=12)

    @model_validator(mode="after")
    def require_payment_method_without_package(self) -> "BookingCreateRequest":
        if self.package_id is None and self.payment_method is None:
            raise ValueError("payment_method is required when package_id is not provided.")
        if self.package_id is None and self.payment_method == "credit_card" and not (self.card_token or self.card_id):
            raise ValueError("card_token or card_id is required when payment_method is 'credit_card'.")
        return self


class BookingRescheduleRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    starts_at: datetime
    reason: str | None = None


class BookingDecisionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    decision: Literal["accept", "reject"]
    reason: str | None = None
    chat_message: str | None = None


class BookingPaymentRetryRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    payment_method: PaymentMethod
    card_token: str | None = None
    card_id: str | None = None
    installments: int = Field(default=1, ge=1, le=12)

    @model_validator(mode="after")
    def require_card_reference_for_credit_card(self) -> "BookingPaymentRetryRequest":
        if self.payment_method == "credit_card" and not (self.card_token or self.card_id):
            raise ValueError("card_token or card_id is required when payment_method is 'credit_card'.")
        return self


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


class EmptyRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    @model_validator(mode="after")
    def allow_empty_object(self) -> "EmptyRequest":
        return self
