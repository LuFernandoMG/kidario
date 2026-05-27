from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.v2_bookings import PaymentMethod, PaymentOrder


PackagePurchaseStatus = Literal["pending_payment", "active", "completed", "canceled", "expired"]


class PackagePlan(BaseModel):
    id: UUID
    teacher_id: UUID
    code: str
    name: str
    description: str | None = None
    sessions_count: int
    discount_percent: float
    is_active: bool
    estimated_original_amount_cents: int | None = None
    estimated_final_amount_cents: int | None = None
    currency: str = "BRL"
    created_at: datetime
    updated_at: datetime


class PackagePlansResponse(BaseModel):
    package_plans: list[PackagePlan]


class PackagePlanCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: str = Field(min_length=1, max_length=80)
    name: str = Field(min_length=1, max_length=160)
    description: str | None = None
    sessions_count: int = Field(gt=0)
    discount_percent: float = Field(default=0, ge=0, le=100)
    is_active: bool = True


class PackagePlanUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: str | None = Field(default=None, min_length=1, max_length=80)
    name: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = None
    sessions_count: int | None = Field(default=None, gt=0)
    discount_percent: float | None = Field(default=None, ge=0, le=100)
    is_active: bool | None = None

    @model_validator(mode="after")
    def ensure_not_empty(self) -> "PackagePlanUpdateRequest":
        if not self.model_fields_set:
            raise ValueError("Payload must include at least one field to patch.")
        return self


class BookingPackage(BaseModel):
    id: UUID
    package_plan_id: UUID
    teacher_id: UUID
    parent_id: UUID
    child_id: UUID
    total_sessions: int
    booked_sessions: int
    completed_sessions: int
    remaining_sessions: int
    original_unit_amount_cents: int
    original_amount_cents: int
    discount_percent: float
    discount_amount_cents: int
    final_amount_cents: int
    currency: str = "BRL"
    status: PackagePurchaseStatus
    valid_from: datetime | None = None
    expires_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    payment_order: PaymentOrder | None = None


class BookingPackagesResponse(BaseModel):
    packages: list[BookingPackage]


class PackagePurchaseCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    package_plan_id: UUID
    child_id: UUID
    payment_method: PaymentMethod
