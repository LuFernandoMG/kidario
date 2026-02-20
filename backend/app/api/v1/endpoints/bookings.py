from datetime import date
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Security, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.security import AuthUser
from app.db.session import get_db
from app.schemas.bookings import (
    BookingCancelPatch,
    BookingCancelResponse,
    BookingCompletePatch,
    BookingCompleteResponse,
    BookingCreateRequest,
    BookingCreateResponse,
    BookingDetailResponse,
    BookingReschedulePatch,
    BookingRescheduleResponse,
    ParentAgendaResponse,
    TeacherAgendaResponse,
    TeacherAvailabilitySlotsResponse,
)
from app.services.booking_service import (
    BookingConflictError,
    BookingNotFoundError,
    BookingPermissionError,
    BookingValidationError,
    cancel_booking,
    complete_booking,
    create_booking,
    get_booking_detail,
    get_parent_agenda,
    get_teacher_agenda,
    get_teacher_availability_slots,
    reschedule_booking,
)

router = APIRouter(tags=["bookings"])


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


@router.post("/bookings", response_model=BookingCreateResponse, status_code=status.HTTP_201_CREATED)
def post_booking(
    payload: BookingCreateRequest,
    user: AuthUser = Security(get_current_user),
    db: Session = Depends(get_db),
) -> BookingCreateResponse:
    try:
        with db.begin():
            data = create_booking(db, user, payload)
    except BookingPermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except BookingValidationError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except BookingConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except SQLAlchemyError as exc:
        _raise_http_from_sql_error(exc)
    return BookingCreateResponse(**data)


@router.get("/bookings/parent/agenda", response_model=ParentAgendaResponse)
def get_parent_agenda_endpoint(
    tab: Literal["upcoming", "past"] = Query(default="upcoming"),
    child_id: UUID | None = Query(default=None),
    user: AuthUser = Security(get_current_user),
    db: Session = Depends(get_db),
) -> ParentAgendaResponse:
    try:
        data = get_parent_agenda(db, user, tab=tab, child_id=child_id)
    except BookingPermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except BookingValidationError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except SQLAlchemyError as exc:
        _raise_http_from_sql_error(exc)
    return ParentAgendaResponse(**data)


@router.get("/bookings/teacher/agenda", response_model=TeacherAgendaResponse)
def get_teacher_agenda_endpoint(
    tab: Literal["upcoming", "past"] = Query(default="upcoming"),
    booking_status: str | None = Query(default=None, alias="status"),
    user: AuthUser = Security(get_current_user),
    db: Session = Depends(get_db),
) -> TeacherAgendaResponse:
    try:
        data = get_teacher_agenda(db, user, tab=tab, status=booking_status)
    except BookingPermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except BookingValidationError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except SQLAlchemyError as exc:
        _raise_http_from_sql_error(exc)
    return TeacherAgendaResponse(**data)


@router.get("/bookings/{booking_id}", response_model=BookingDetailResponse)
def get_booking_detail_endpoint(
    booking_id: UUID,
    user: AuthUser = Security(get_current_user),
    db: Session = Depends(get_db),
) -> BookingDetailResponse:
    try:
        data = get_booking_detail(db, user, booking_id)
    except BookingNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except BookingPermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except SQLAlchemyError as exc:
        _raise_http_from_sql_error(exc)
    return BookingDetailResponse(**data)


@router.patch("/bookings/{booking_id}/reschedule", response_model=BookingRescheduleResponse)
def patch_booking_reschedule(
    booking_id: UUID,
    payload: BookingReschedulePatch,
    user: AuthUser = Security(get_current_user),
    db: Session = Depends(get_db),
) -> BookingRescheduleResponse:
    try:
        with db.begin():
            data = reschedule_booking(db, user, booking_id, payload)
    except BookingNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except BookingPermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except BookingValidationError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except BookingConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except SQLAlchemyError as exc:
        _raise_http_from_sql_error(exc)
    return BookingRescheduleResponse(**data)


@router.patch("/bookings/{booking_id}/cancel", response_model=BookingCancelResponse)
def patch_booking_cancel(
    booking_id: UUID,
    payload: BookingCancelPatch,
    user: AuthUser = Security(get_current_user),
    db: Session = Depends(get_db),
) -> BookingCancelResponse:
    try:
        with db.begin():
            data = cancel_booking(db, user, booking_id, payload)
    except BookingNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except BookingPermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except BookingValidationError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except BookingConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except SQLAlchemyError as exc:
        _raise_http_from_sql_error(exc)
    return BookingCancelResponse(**data)


@router.patch("/bookings/{booking_id}/complete", response_model=BookingCompleteResponse)
def patch_booking_complete(
    booking_id: UUID,
    payload: BookingCompletePatch,
    user: AuthUser = Security(get_current_user),
    db: Session = Depends(get_db),
) -> BookingCompleteResponse:
    try:
        with db.begin():
            data = complete_booking(db, user, booking_id, payload)
    except BookingNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except BookingPermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except BookingValidationError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except BookingConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except SQLAlchemyError as exc:
        _raise_http_from_sql_error(exc)
    return BookingCompleteResponse(**data)


@router.get(
    "/teachers/{teacher_profile_id}/availability/slots",
    response_model=TeacherAvailabilitySlotsResponse,
)
def get_teacher_slots_endpoint(
    teacher_profile_id: UUID,
    date_from: date = Query(alias="from"),
    date_to: date = Query(alias="to"),
    duration_minutes: int = Query(default=60, ge=15, le=300),
    _: AuthUser = Security(get_current_user),
    db: Session = Depends(get_db),
) -> TeacherAvailabilitySlotsResponse:
    try:
        data = get_teacher_availability_slots(db, teacher_profile_id, date_from, date_to, duration_minutes)
    except BookingValidationError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except BookingNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except SQLAlchemyError as exc:
        _raise_http_from_sql_error(exc)
    return TeacherAvailabilitySlotsResponse(**data)
