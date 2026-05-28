from uuid import UUID

from sqlalchemy.orm import Session

from app.core.security import AuthUser
from app.schemas.reviews import BookingReviewCreateRequest as LegacyReviewCreateRequest
from app.schemas.reviews import ReviewModerationPatch as LegacyReviewModerationPatch
from app.schemas.v2_reviews import ReviewCreateRequest, ReviewModerationRequest
from app.services.review_service import (
    ReviewConflictError,
    ReviewNotFoundError,
    ReviewPermissionError,
    ReviewValidationError,
    create_booking_review,
    get_booking_review,
    list_admin_reviews,
    list_public_teacher_reviews,
    moderate_review,
)


def _public_review(row: dict) -> dict:
    return {
        "id": row["id"],
        "booking_id": row["booking_id"],
        "teacher_id": row["teacher_id"],
        "rating": row["rating"],
        "comment": row["comment"],
        "submitted_at": row["submitted_at"],
    }


def create_review_v2(db: Session, user: AuthUser, booking_id: UUID, payload: ReviewCreateRequest) -> dict:
    legacy_payload = LegacyReviewCreateRequest(**payload.model_dump())
    return create_booking_review(db, user, booking_id, legacy_payload)


def get_booking_review_v2(db: Session, user: AuthUser, booking_id: UUID) -> dict:
    return get_booking_review(db, user, booking_id)


def list_public_reviews_v2(db: Session, *, teacher_id: UUID, limit: int = 30, offset: int = 0) -> dict:
    data = list_public_teacher_reviews(db, teacher_id, limit=limit, offset=offset)
    return {"reviews": [_public_review(row) for row in data["reviews"]]}


def list_admin_reviews_v2(
    db: Session,
    *,
    status: str | None = None,
    teacher_id: UUID | None = None,
    parent_id: UUID | None = None,
    booking_id: UUID | None = None,
    limit: int = 100,
    offset: int = 0,
) -> dict:
    return list_admin_reviews(
        db,
        status=status,
        teacher_id=teacher_id,
        parent_id=parent_id,
        booking_id=booking_id,
        limit=limit,
        offset=offset,
    )


def moderate_review_v2(db: Session, review_id: UUID, payload: ReviewModerationRequest) -> dict:
    legacy_payload = LegacyReviewModerationPatch(**payload.model_dump())
    return moderate_review(db, review_id, legacy_payload)


__all__ = [
    "ReviewConflictError",
    "ReviewNotFoundError",
    "ReviewPermissionError",
    "ReviewValidationError",
]
