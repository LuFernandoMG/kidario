from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import get_db
from app.schemas.marketplace import MarketplaceTeacherDetail, MarketplaceTeachersResponse
from app.schemas.reviews import BookingReviewsResponse
from app.services.marketplace_service import (
    MarketplaceNotFoundError,
    get_marketplace_teacher_detail,
    list_marketplace_teachers,
)
from app.services.review_service import list_public_teacher_reviews

router = APIRouter(prefix="/marketplace", tags=["marketplace"])


def _raise_http_from_sql_error(exc: SQLAlchemyError) -> None:
    sqlstate = getattr(getattr(exc, "orig", None), "sqlstate", None)
    if sqlstate == "42P01":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database schema not initialized. Run SQL migrations in backend/sql.",
        ) from exc

    settings = get_settings()
    detail = "Database error."
    if settings.env != "production":
        detail = f"{detail} Reason: {exc}"
    raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=detail) from exc


@router.get("/teachers", response_model=MarketplaceTeachersResponse)
def get_marketplace_teachers(db: Session = Depends(get_db)) -> MarketplaceTeachersResponse:
    try:
        data = list_marketplace_teachers(db)
    except SQLAlchemyError as exc:
        _raise_http_from_sql_error(exc)
    return MarketplaceTeachersResponse(**data)


@router.get("/teachers/{teacher_id}", response_model=MarketplaceTeacherDetail)
def get_marketplace_teacher(
    teacher_id: UUID,
    db: Session = Depends(get_db),
) -> MarketplaceTeacherDetail:
    try:
        data = get_marketplace_teacher_detail(db, teacher_id)
    except MarketplaceNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except SQLAlchemyError as exc:
        _raise_http_from_sql_error(exc)
    return MarketplaceTeacherDetail(**data)


@router.get("/teachers/{teacher_id}/reviews", response_model=BookingReviewsResponse)
def get_marketplace_teacher_reviews(
    teacher_id: UUID,
    limit: int = Query(default=30, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> BookingReviewsResponse:
    try:
        data = list_public_teacher_reviews(db, teacher_id, limit=limit, offset=offset)
    except SQLAlchemyError as exc:
        _raise_http_from_sql_error(exc)
    return BookingReviewsResponse(**data)
