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
    bio: str | None = None
    city: str | None = None
    state: str | None = None
    lesson_duration_minutes: int
    next_slots: list[MarketplaceTeacherSlotsDay]
