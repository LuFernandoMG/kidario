from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


TeacherModality = Literal["online", "presencial", "ambos"]
ExploreModalityFilter = Literal["online", "presencial"]
ExploreSort = Literal["relevance", "soonest_available", "rating", "price_low", "price_high", "nearby"]


class PublicLocation(BaseModel):
    city: str
    state: str
    country: str = "BR"
    distance_km: float | None = None


class RatingSummary(BaseModel):
    average: float | None = None
    count: int = 0


class AvailabilitySlot(BaseModel):
    starts_at: datetime
    duration_minutes: int
    modality: ExploreModalityFilter


class AvailabilitySummary(BaseModel):
    next_available_at: datetime | None = None
    preview_slots: list[AvailabilitySlot] = Field(default_factory=list)
    range_days: int | None = None


class PackageSummary(BaseModel):
    has_packages: bool
    starting_estimated_amount_cents: int | None = None
    max_discount_percent: float | None = None


class PublicPackagePlan(BaseModel):
    id: UUID
    code: str
    name: str
    description: str | None = None
    sessions_count: int
    discount_percent: float
    estimated_original_amount_cents: int | None = None
    estimated_final_amount_cents: int | None = None
    currency: str = "BRL"
    is_active: bool


class PublicReviewPreview(BaseModel):
    id: UUID
    rating: int
    comment: str | None = None
    submitted_at: datetime


class PublicAcademicRecord(BaseModel):
    id: UUID
    degree_type: str
    course_name: str
    institution: str
    completion_year: str | None = None


class PublicTeacherExperience(BaseModel):
    id: UUID
    institution: str
    role: str
    description: str
    period_from: str
    period_to: str | None = None
    current_position: bool


class TeacherSearchResult(BaseModel):
    teacher_id: UUID
    display_name: str
    biography_preview: str | None = None
    profile_photo_url: str | None = None
    location: PublicLocation
    modality: TeacherModality | None = None
    hourly_rate_cents: int | None = None
    lesson_duration_minutes: int | None = None
    skills: list[str] = Field(default_factory=list)
    rating_summary: RatingSummary
    availability_summary: AvailabilitySummary
    package_summary: PackageSummary
    latest_review: PublicReviewPreview | None = None


class ExploreTeachersResponse(BaseModel):
    teachers: list[TeacherSearchResult]


class TeacherPublicProfile(BaseModel):
    teacher_id: UUID
    display_name: str
    biography: str | None = None
    profile_photo_url: str | None = None
    location: PublicLocation
    modality: TeacherModality | None = None
    hourly_rate_cents: int | None = None
    lesson_duration_minutes: int | None = None
    skills: list[str] = Field(default_factory=list)
    academic_records: list[PublicAcademicRecord] = Field(default_factory=list)
    experiences: list[PublicTeacherExperience] = Field(default_factory=list)
    rating_summary: RatingSummary
    availability_summary: AvailabilitySummary
    package_summary: PackageSummary
    package_plans: list[PublicPackagePlan] = Field(default_factory=list)
    latest_reviews: list[PublicReviewPreview] = Field(default_factory=list)
