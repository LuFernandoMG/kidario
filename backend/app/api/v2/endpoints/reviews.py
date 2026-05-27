from collections.abc import Callable
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Security, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.deps import get_current_admin, get_current_user
from app.core.config import get_settings
from app.core.security import AuthUser
from app.db.session import get_db
from app.schemas.v2_reviews import (
    PublicReviewsResponse,
    Review,
    ReviewCreateRequest,
    ReviewModerationRequest,
    ReviewsResponse,
)
from app.services.review_v2_service import (
    ReviewConflictError,
    ReviewNotFoundError,
    ReviewPermissionError,
    ReviewValidationError,
    create_review_v2,
    get_booking_review_v2,
    list_admin_reviews_v2,
    list_public_reviews_v2,
    moderate_review_v2,
)

router = APIRouter(tags=["v2-reviews"])


def _raise_http_from_sql_error(exc: SQLAlchemyError) -> None:
    sqlstate = getattr(getattr(exc, "orig", None), "sqlstate", None)
    if sqlstate == "42P01":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database schema not initialized. Run backend/sql migrations through 012.",
        ) from exc

    settings = get_settings()
    detail = "Database error."
    if settings.env != "production":
        detail = f"{detail} Reason: {exc}"
    raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=detail) from exc


def _run_write_transaction(db: Session, operation: Callable[[], dict]) -> dict:
    if hasattr(db, "in_transaction") and db.in_transaction():
        try:
            data = operation()
            db.commit()
            return data
        except Exception:
            db.rollback()
            raise
    with db.begin():
        return operation()


def _handle_review_error(exc: Exception) -> None:
    if isinstance(exc, ReviewNotFoundError):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    if isinstance(exc, ReviewPermissionError):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    if isinstance(exc, ReviewValidationError):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    if isinstance(exc, ReviewConflictError):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    if isinstance(exc, SQLAlchemyError):
        _raise_http_from_sql_error(exc)
    raise exc


@router.get("/reviews", response_model=PublicReviewsResponse)
def list_reviews_endpoint(
    teacher_id: UUID = Query(...),
    limit: int = Query(default=30, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> PublicReviewsResponse:
    try:
        data = list_public_reviews_v2(db, teacher_id=teacher_id, limit=limit, offset=offset)
    except Exception as exc:
        _handle_review_error(exc)
    return PublicReviewsResponse(**data)


@router.post("/bookings/{booking_id}/review", response_model=Review, status_code=status.HTTP_201_CREATED)
def post_booking_review_endpoint(
    booking_id: UUID,
    payload: ReviewCreateRequest,
    user: AuthUser = Security(get_current_user),
    db: Session = Depends(get_db),
) -> Review:
    try:
        data = _run_write_transaction(db, lambda: create_review_v2(db, user, booking_id, payload))
    except Exception as exc:
        _handle_review_error(exc)
    return Review(**data)


@router.get("/bookings/{booking_id}/review", response_model=Review)
def get_booking_review_endpoint(
    booking_id: UUID,
    user: AuthUser = Security(get_current_user),
    db: Session = Depends(get_db),
) -> Review:
    try:
        data = get_booking_review_v2(db, user, booking_id)
    except Exception as exc:
        _handle_review_error(exc)
    return Review(**data)


@router.get("/admin/reviews", response_model=ReviewsResponse)
def list_admin_reviews_endpoint(
    status_filter: str | None = Query(default=None, alias="status"),
    teacher_id: UUID | None = Query(default=None),
    parent_id: UUID | None = Query(default=None),
    booking_id: UUID | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    _: AuthUser = Security(get_current_admin),
    db: Session = Depends(get_db),
) -> ReviewsResponse:
    try:
        data = list_admin_reviews_v2(
            db,
            status=status_filter,
            teacher_id=teacher_id,
            parent_id=parent_id,
            booking_id=booking_id,
            limit=limit,
            offset=offset,
        )
    except Exception as exc:
        _handle_review_error(exc)
    return ReviewsResponse(**data)


@router.patch("/admin/reviews/{review_id}", response_model=Review)
def patch_admin_review_endpoint(
    review_id: UUID,
    payload: ReviewModerationRequest,
    _: AuthUser = Security(get_current_admin),
    db: Session = Depends(get_db),
) -> Review:
    try:
        data = _run_write_transaction(db, lambda: moderate_review_v2(db, review_id, payload))
    except Exception as exc:
        _handle_review_error(exc)
    return Review(**data)
