from datetime import date
from uuid import UUID

from pydantic import BaseModel


class MarketplaceTeacherSummary(BaseModel):
    id: UUID
    name: str
    avatar_url: str | None = None
    rating: float
    review_count: int
    price_per_class: float
    specialties: list[str]
    is_verified: bool
    is_online: bool
    is_presential: bool
    next_availability: str | None = None
    experience_label: str
    bio_snippet: str | None = None


class MarketplaceTeachersResponse(BaseModel):
    teachers: list[MarketplaceTeacherSummary]


class MarketplaceTeacherSlotsDay(BaseModel):
    date_iso: date
    date_label: str
    times: list[str]


class MarketplaceTeacherExperience(BaseModel):
    id: UUID
    institution: str
    role: str
    responsibilities: str
    period_from: str
    period_to: str | None = None
    current_position: bool


class MarketplaceTeacherFormation(BaseModel):
    id: UUID
    degree_type: str
    course_name: str
    institution: str
    completion_year: str | None = None


class MarketplaceTeacherDetail(BaseModel):
    id: UUID
    name: str
    avatar_url: str | None = None
    rating: float
    review_count: int
    price_per_class: float
    specialties: list[str]
    is_verified: bool
    is_online: bool
    is_presential: bool
    experience_label: str
    request_experience_anonymity: bool = False
    bio: str | None = None
    city: str | None = None
    state: str | None = None
    formations: list[MarketplaceTeacherFormation] = []
    experiences: list[MarketplaceTeacherExperience] = []
    lesson_duration_minutes: int
    next_slots: list[MarketplaceTeacherSlotsDay]
