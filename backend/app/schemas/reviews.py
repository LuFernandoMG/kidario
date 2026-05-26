from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


ReviewStatus = Literal["published", "hidden", "reported", "removed"]


class BookingReviewCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    rating: int = Field(ge=1, le=5)
    comment: str | None = Field(default=None, max_length=2000)
    feedback: dict[str, Any] = Field(default_factory=dict)
    is_public: bool = True

    @field_validator("comment")
    @classmethod
    def validate_comment(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        if not normalized:
            raise ValueError("comment cannot be empty when provided.")
        return normalized


class BookingReviewResponse(BaseModel):
    id: UUID
    booking_id: UUID
    parent_id: UUID
    teacher_id: UUID
    rating: int
    comment: str | None = None
    feedback: dict[str, Any]
    is_public: bool
    status: ReviewStatus
    submitted_at: datetime
    created_at: datetime
    updated_at: datetime


class BookingReviewsResponse(BaseModel):
    reviews: list[BookingReviewResponse]


class ReviewModerationPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: ReviewStatus | None = None
    is_public: bool | None = None

    @field_validator("status")
    @classmethod
    def ensure_status(cls, value: ReviewStatus | None) -> ReviewStatus | None:
        return value


class AdminReviewsResponse(BaseModel):
    reviews: list[BookingReviewResponse]
