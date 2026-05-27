from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Security, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.deps import get_current_teacher_user, get_current_user
from app.core.config import get_settings
from app.core.security import AuthUser
from app.db.session import get_db
from app.schemas.v2_bookings import PaymentOrder, PaymentOrdersResponse
from app.services.booking_v2_service import (
    BookingNotFoundError,
    BookingPermissionError,
    BookingValidationError,
    get_booking_payment_v2,
    list_parent_payments_v2,
    list_teacher_payments_v2,
)

router = APIRouter(tags=["v2-payments"])


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


def _handle_payment_error(exc: Exception) -> None:
    if isinstance(exc, BookingNotFoundError):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    if isinstance(exc, BookingPermissionError):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    if isinstance(exc, BookingValidationError):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    if isinstance(exc, SQLAlchemyError):
        _raise_http_from_sql_error(exc)
    raise exc


@router.get("/bookings/{booking_id}/payment", response_model=PaymentOrder)
def get_booking_payment_endpoint(
    booking_id: UUID,
    user: AuthUser = Security(get_current_user),
    db: Session = Depends(get_db),
) -> PaymentOrder:
    try:
        data = get_booking_payment_v2(db, user, booking_id)
    except Exception as exc:
        _handle_payment_error(exc)
    return PaymentOrder(**data)


@router.get("/parents/me/payments", response_model=PaymentOrdersResponse)
def list_parent_payments_endpoint(
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user: AuthUser = Security(get_current_user),
    db: Session = Depends(get_db),
) -> PaymentOrdersResponse:
    try:
        data = list_parent_payments_v2(db, user, limit=limit, offset=offset)
    except Exception as exc:
        _handle_payment_error(exc)
    return PaymentOrdersResponse(**data)


@router.get("/teachers/me/payments", response_model=PaymentOrdersResponse)
def list_teacher_payments_endpoint(
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user: AuthUser = Security(get_current_teacher_user),
    db: Session = Depends(get_db),
) -> PaymentOrdersResponse:
    try:
        data = list_teacher_payments_v2(db, user, limit=limit, offset=offset)
    except Exception as exc:
        _handle_payment_error(exc)
    return PaymentOrdersResponse(**data)
