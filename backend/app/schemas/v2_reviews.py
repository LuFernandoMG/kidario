from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


ReviewStatus = Literal["published", "hidden", "reported", "removed"]


class Review(BaseModel):
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


class ReviewsResponse(BaseModel):
    reviews: list[Review]


class ReviewModerationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: ReviewStatus | None = None
    is_public: bool | None = None


class PublicReview(BaseModel):
    id: UUID
    booking_id: UUID
    teacher_id: UUID
    rating: int
    comment: str | None = None
    submitted_at: datetime


class PublicReviewsResponse(BaseModel):
    reviews: list[PublicReview]


class ReviewCreateRequest(BaseModel):
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
