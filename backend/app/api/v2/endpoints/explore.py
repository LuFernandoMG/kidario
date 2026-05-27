from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import get_db
from app.schemas.v2_explore import (
    ExploreModalityFilter,
    ExploreSort,
    ExploreTeachersResponse,
    TeacherPublicProfile,
)
from app.services.explore_v2_service import ExploreNotFoundError, get_explore_teacher_detail, list_explore_teachers

router = APIRouter(prefix="/explore", tags=["v2-explore"])


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


@router.get("/teachers", response_model=ExploreTeachersResponse)
def get_explore_teachers_endpoint(
    query: str | None = Query(default=None),
    skill: str | None = Query(default=None),
    city: str | None = Query(default=None),
    state: str | None = Query(default=None),
    modality: ExploreModalityFilter | None = Query(default=None),
    available_from: datetime | None = Query(default=None),
    available_to: datetime | None = Query(default=None),
    duration_minutes: int | None = Query(default=None, ge=15, le=300),
    min_rating: float | None = Query(default=None, ge=1, le=5),
    has_reviews: bool | None = Query(default=None),
    max_hourly_rate_cents: int | None = Query(default=None, ge=0),
    sort: ExploreSort = Query(default="relevance"),
    near_lat: float | None = Query(default=None, ge=-90, le=90),
    near_lng: float | None = Query(default=None, ge=-180, le=180),
    radius_km: float | None = Query(default=None, gt=0),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> ExploreTeachersResponse:
    try:
        data = list_explore_teachers(
            db,
            query=query,
            skill=skill,
            city=city,
            state=state,
            modality=modality,
            available_from=available_from,
            available_to=available_to,
            duration_minutes=duration_minutes,
            min_rating=min_rating,
            has_reviews=has_reviews,
            max_hourly_rate_cents=max_hourly_rate_cents,
            sort=sort,
            near_lat=near_lat,
            near_lng=near_lng,
            radius_km=radius_km,
            limit=limit,
            offset=offset,
        )
    except SQLAlchemyError as exc:
        _raise_http_from_sql_error(exc)
    return ExploreTeachersResponse(**data)


@router.get("/teachers/{teacher_id}", response_model=TeacherPublicProfile)
def get_explore_teacher_detail_endpoint(
    teacher_id: UUID,
    available_from: datetime | None = Query(default=None),
    available_to: datetime | None = Query(default=None),
    duration_minutes: int | None = Query(default=None, ge=15, le=300),
    modality: ExploreModalityFilter | None = Query(default=None),
    db: Session = Depends(get_db),
) -> TeacherPublicProfile:
    try:
        data = get_explore_teacher_detail(
            db,
            teacher_id,
            available_from=available_from,
            available_to=available_to,
            duration_minutes=duration_minutes,
            modality=modality,
        )
    except ExploreNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except SQLAlchemyError as exc:
        _raise_http_from_sql_error(exc)
    return TeacherPublicProfile(**data)
