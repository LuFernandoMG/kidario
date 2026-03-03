from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.bookings import BookingModality, BookingStatus, PaymentMethod, PaymentStatus


class AdminTeacherRecord(BaseModel):
    profile_id: UUID
    full_name: str
    email: str
    phone: str | None = None
    city: str | None = None
    state: str | None = None
    modality: str | None = None
    hourly_rate: float | None = None
    formations: list[str] = Field(default_factory=list)
    experiences: list[str] = Field(default_factory=list)
    is_active_teacher: bool
    created_at: datetime


class AdminParentRecord(BaseModel):
    profile_id: UUID
    full_name: str
    email: str
    phone: str | None = None
    address: str | None = None
    bio: str | None = None
    children_count: int
    created_at: datetime


class AdminBookingRecord(BaseModel):
    booking_id: UUID
    parent_profile_id: UUID
    parent_name: str
    teacher_profile_id: UUID
    teacher_name: str
    child_id: UUID
    child_name: str
    date_iso: date
    time: str
    duration_minutes: int
    modality: BookingModality
    booking_status: BookingStatus
    payment_method: PaymentMethod
    payment_status: PaymentStatus
    price_total: float
    currency: str
    created_at: datetime


class AdminPaymentRecord(BaseModel):
    booking_id: UUID
    parent_profile_id: UUID
    parent_name: str
    teacher_profile_id: UUID
    teacher_name: str
    payment_method: PaymentMethod
    payment_status: PaymentStatus
    booking_status: BookingStatus
    price_total: float
    currency: str
    created_at: datetime
    updated_at: datetime


class AdminDashboardResponse(BaseModel):
    teachers: list[AdminTeacherRecord]
    parents: list[AdminParentRecord]
    bookings: list[AdminBookingRecord]
    payments: list[AdminPaymentRecord]


class AdminAccessResponse(BaseModel):
    status: str = "ok"
    is_admin: bool = True
