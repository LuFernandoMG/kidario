from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.v2_bookings import BookingModality, BookingStatus, PaymentMethod, PaymentOrderStatus


class AdminTeacherRecord(BaseModel):
    teacher_id: UUID
    user_id: UUID
    full_name: str
    email: str
    phone: str | None = None
    city: str | None = None
    state: str | None = None
    modality: str | None = None
    hourly_rate_cents: int | None = None
    academic_records: list[str] = Field(default_factory=list)
    experiences: list[str] = Field(default_factory=list)
    is_active: bool
    created_at: datetime


class AdminParentRecord(BaseModel):
    parent_id: UUID
    user_id: UUID
    full_name: str
    email: str
    phone: str
    city: str
    state: str
    bio: str | None = None
    children_count: int
    created_at: datetime


class AdminBookingRecord(BaseModel):
    booking_id: UUID
    parent_id: UUID
    parent_name: str
    teacher_id: UUID
    teacher_name: str
    child_id: UUID
    child_name: str
    starts_at: datetime
    duration_minutes: int
    modality: BookingModality
    booking_status: BookingStatus
    amount_cents: int
    currency: str
    created_at: datetime


class AdminPaymentRecord(BaseModel):
    payment_order_id: UUID
    booking_id: UUID | None = None
    package_id: UUID | None = None
    parent_id: UUID
    parent_name: str
    teacher_id: UUID | None = None
    teacher_name: str | None = None
    payment_method: PaymentMethod | None = None
    payment_status: PaymentOrderStatus
    booking_status: BookingStatus | None = None
    amount_cents: int
    currency: str
    created_at: datetime
    updated_at: datetime


class AdminReviewRecord(BaseModel):
    id: UUID
    booking_id: UUID
    parent_id: UUID
    teacher_id: UUID
    rating: int
    comment: str | None = None
    is_public: bool
    status: str
    submitted_at: datetime
    created_at: datetime
    updated_at: datetime


class AdminDashboardResponse(BaseModel):
    teachers: list[AdminTeacherRecord]
    parents: list[AdminParentRecord]
    bookings: list[AdminBookingRecord]
    payments: list[AdminPaymentRecord]
    reviews: list[AdminReviewRecord] = Field(default_factory=list)


class AdminAccessResponse(BaseModel):
    status: str = "ok"
    is_admin: bool = True


class TeacherActivationPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    is_active: bool


class TeacherActivationResponse(BaseModel):
    status: str = "ok"
    teacher_id: UUID
    is_active: bool
