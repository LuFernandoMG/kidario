from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, Field


class MarketplaceTeacherSummary(BaseModel):
    id: UUID
    user_id: UUID
    name: str
    avatar_url: str | None = None
    rating: float
    review_count: int
    price_per_class_cents: int
    skills: list[str]
    is_verified: bool
    is_online: bool
    is_presential: bool
    next_availability: datetime | None = None
    experience_label: str
    bio_snippet: str | None = None


class MarketplaceTeachersResponse(BaseModel):
    teachers: list[MarketplaceTeacherSummary]


class MarketplaceTeacherSlotsDay(BaseModel):
    date: date
    starts_at: list[datetime]


class MarketplaceTeacherExperience(BaseModel):
    id: UUID
    teacher_id: UUID
    institution: str
    role: str
    description: str
    period_from: str
    period_to: str | None = None
    current_position: bool


class MarketplaceTeacherAcademicRecord(BaseModel):
    id: UUID
    teacher_id: UUID
    degree_type: str
    course_name: str
    institution: str
    completion_year: str | None = None


class MarketplaceTeacherDetail(BaseModel):
    id: UUID
    user_id: UUID
    name: str
    avatar_url: str | None = None
    rating: float
    review_count: int
    price_per_class_cents: int
    skills: list[str]
    is_verified: bool
    is_online: bool
    is_presential: bool
    experience_label: str
    hide_experience: bool = False
    bio: str | None = None
    city: str | None = None
    state: str | None = None
    academic_records: list[MarketplaceTeacherAcademicRecord] = Field(default_factory=list)
    experiences: list[MarketplaceTeacherExperience] = Field(default_factory=list)
    lesson_duration_minutes: int
    next_slots: list[MarketplaceTeacherSlotsDay]
