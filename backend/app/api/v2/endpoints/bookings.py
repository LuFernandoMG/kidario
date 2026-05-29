from collections.abc import Callable
from datetime import date
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Security, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.deps import get_current_teacher_user, get_current_user
from app.core.config import get_settings
from app.core.security import AuthUser
from app.db.session import get_db
from app.schemas.v2_bookings import (
    Booking,
    BookingCancelRequest,
    BookingCompleteRequest,
    BookingCreateRequest,
    BookingDecisionRequest,
    BookingPaymentRetryRequest,
    BookingRescheduleRequest,
    BookingsResponse,
    TeacherAvailabilitySlotsResponse,
    TeacherFollowUpContextResponse,
)
from app.services.booking_v2_service import (
    BookingConflictError,
    BookingNotFoundError,
    BookingPermissionError,
    BookingValidationError,
    cancel_booking_v2,
    complete_booking_v2,
    create_booking_v2,
    decide_booking_v2,
    get_booking_v2,
    get_teacher_availability_slots_v2,
    get_teacher_follow_up_context_v2,
    list_parent_bookings_v2,
    list_teacher_bookings_v2,
    reschedule_booking_v2,
    retry_booking_payment_v2,
    teacher_reschedule_booking_v2,
)

router = APIRouter(tags=["v2-bookings"])


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


def _handle_booking_error(exc: Exception) -> None:
    if isinstance(exc, BookingNotFoundError):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    if isinstance(exc, BookingPermissionError):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    if isinstance(exc, BookingValidationError):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    if isinstance(exc, BookingConflictError):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    if isinstance(exc, SQLAlchemyError):
        _raise_http_from_sql_error(exc)
    raise exc


@router.post("/bookings", response_model=Booking, status_code=status.HTTP_201_CREATED)
def post_booking_endpoint(
    payload: BookingCreateRequest,
    user: AuthUser = Security(get_current_user),
    db: Session = Depends(get_db),
) -> Booking:
    try:
        data = _run_write_transaction(db, lambda: create_booking_v2(db, user, payload))
    except Exception as exc:
        _handle_booking_error(exc)
    return Booking(**data)


@router.get("/parents/me/bookings", response_model=BookingsResponse)
def list_parent_bookings_endpoint(
    tab: Literal["upcoming", "past"] = Query(default="upcoming"),
    booking_status: str | None = Query(default=None, alias="status"),
    child_id: UUID | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user: AuthUser = Security(get_current_user),
    db: Session = Depends(get_db),
) -> BookingsResponse:
    try:
        data = list_parent_bookings_v2(
            db,
            user,
            tab=tab,
            status=booking_status,
            child_id=child_id,
            limit=limit,
            offset=offset,
        )
    except Exception as exc:
        _handle_booking_error(exc)
    return BookingsResponse(**data)


@router.get("/teachers/me/bookings", response_model=BookingsResponse)
def list_teacher_bookings_endpoint(
    tab: Literal["upcoming", "past"] = Query(default="upcoming"),
    booking_status: str | None = Query(default=None, alias="status"),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user: AuthUser = Security(get_current_teacher_user),
    db: Session = Depends(get_db),
) -> BookingsResponse:
    try:
        data = list_teacher_bookings_v2(
            db,
            user,
            tab=tab,
            status=booking_status,
            limit=limit,
            offset=offset,
        )
    except Exception as exc:
        _handle_booking_error(exc)
    return BookingsResponse(**data)


@router.get("/bookings/{booking_id}", response_model=Booking)
def get_booking_endpoint(
    booking_id: UUID,
    user: AuthUser = Security(get_current_user),
    db: Session = Depends(get_db),
) -> Booking:
    try:
        data = get_booking_v2(db, user, booking_id)
    except Exception as exc:
        _handle_booking_error(exc)
    return Booking(**data)


@router.patch("/bookings/{booking_id}/reschedule", response_model=Booking)
def patch_booking_reschedule_endpoint(
    booking_id: UUID,
    payload: BookingRescheduleRequest,
    user: AuthUser = Security(get_current_user),
    db: Session = Depends(get_db),
) -> Booking:
    try:
        data = _run_write_transaction(db, lambda: reschedule_booking_v2(db, user, booking_id, payload))
    except Exception as exc:
        _handle_booking_error(exc)
    return Booking(**data)


@router.post("/bookings/{booking_id}/decision", response_model=Booking)
def post_booking_decision_endpoint(
    booking_id: UUID,
    payload: BookingDecisionRequest,
    user: AuthUser = Security(get_current_teacher_user),
    db: Session = Depends(get_db),
) -> Booking:
    try:
        data = _run_write_transaction(db, lambda: decide_booking_v2(db, user, booking_id, payload))
    except Exception as exc:
        _handle_booking_error(exc)
    return Booking(**data)


@router.post("/bookings/{booking_id}/payment/retry", response_model=Booking)
def post_booking_payment_retry_endpoint(
    booking_id: UUID,
    payload: BookingPaymentRetryRequest,
    user: AuthUser = Security(get_current_user),
    db: Session = Depends(get_db),
) -> Booking:
    try:
        data = _run_write_transaction(db, lambda: retry_booking_payment_v2(db, user, booking_id, payload))
    except Exception as exc:
        _handle_booking_error(exc)
    return Booking(**data)


@router.patch("/bookings/{booking_id}/teacher/reschedule", response_model=Booking)
def patch_teacher_booking_reschedule_endpoint(
    booking_id: UUID,
    payload: BookingRescheduleRequest,
    user: AuthUser = Security(get_current_teacher_user),
    db: Session = Depends(get_db),
) -> Booking:
    try:
        data = _run_write_transaction(db, lambda: teacher_reschedule_booking_v2(db, user, booking_id, payload))
    except Exception as exc:
        _handle_booking_error(exc)
    return Booking(**data)


@router.post("/bookings/{booking_id}/cancel", response_model=Booking)
def post_booking_cancel_endpoint(
    booking_id: UUID,
    payload: BookingCancelRequest,
    user: AuthUser = Security(get_current_user),
    db: Session = Depends(get_db),
) -> Booking:
    try:
        data = _run_write_transaction(db, lambda: cancel_booking_v2(db, user, booking_id, payload))
    except Exception as exc:
        _handle_booking_error(exc)
    return Booking(**data)


@router.post("/bookings/{booking_id}/complete", response_model=Booking)
def post_booking_complete_endpoint(
    booking_id: UUID,
    payload: BookingCompleteRequest,
    user: AuthUser = Security(get_current_teacher_user),
    db: Session = Depends(get_db),
) -> Booking:
    try:
        data = _run_write_transaction(db, lambda: complete_booking_v2(db, user, booking_id, payload))
    except Exception as exc:
        _handle_booking_error(exc)
    return Booking(**data)


@router.get(
    "/bookings/{booking_id}/teacher/follow-up-context",
    response_model=TeacherFollowUpContextResponse,
)
def get_teacher_follow_up_context_endpoint(
    booking_id: UUID,
    user: AuthUser = Security(get_current_teacher_user),
    db: Session = Depends(get_db),
) -> TeacherFollowUpContextResponse:
    try:
        data = get_teacher_follow_up_context_v2(db, user, booking_id)
    except Exception as exc:
        _handle_booking_error(exc)
    return TeacherFollowUpContextResponse(**data)


@router.get(
    "/teachers/{teacher_id}/availability/slots",
    response_model=TeacherAvailabilitySlotsResponse,
)
def get_teacher_slots_endpoint(
    teacher_id: UUID,
    date_from: date = Query(alias="from"),
    date_to: date = Query(alias="to"),
    duration_minutes: int = Query(default=60, ge=15, le=300),
    _: AuthUser = Security(get_current_user),
    db: Session = Depends(get_db),
) -> TeacherAvailabilitySlotsResponse:
    try:
        data = get_teacher_availability_slots_v2(db, teacher_id, date_from, date_to, duration_minutes)
    except Exception as exc:
        _handle_booking_error(exc)
    return TeacherAvailabilitySlotsResponse(**data)
