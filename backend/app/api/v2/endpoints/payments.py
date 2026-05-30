from collections.abc import Callable
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Security, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.deps import get_current_teacher_user, get_current_user
from app.core.config import get_settings
from app.core.security import AuthUser
from app.db.session import get_db
from app.schemas.v2_bookings import PaymentOrder, PaymentOrdersResponse
from app.schemas.v2_payments import (
    PagarmeWebhookResponse,
    TeacherPaymentRecipientSyncResponse,
    TeacherPayoutProfile,
    TeacherPayoutProfileUpsertRequest,
)
from app.services.booking_v2_service import (
    BookingNotFoundError,
    BookingPermissionError,
    BookingValidationError,
    get_booking_payment_v2,
    list_parent_payments_v2,
    list_teacher_payments_v2,
)
from app.services.payment_v2_service import (
    PaymentNotFoundError,
    PaymentPermissionError,
    PaymentValidationError,
    get_teacher_payout_profile_v2,
    process_pagarme_webhook_v2,
    sync_teacher_payment_recipient_v2,
    upsert_teacher_payout_profile_v2,
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


def _run_write_transaction(db: Session, operation: Callable[[], dict]) -> dict:
    try:
        data = operation()
        db.commit()
        return data
    except Exception:
        db.rollback()
        raise


def _handle_payment_error(exc: Exception) -> None:
    if isinstance(exc, BookingNotFoundError):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    if isinstance(exc, BookingPermissionError):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    if isinstance(exc, BookingValidationError):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    if isinstance(exc, PaymentNotFoundError):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    if isinstance(exc, PaymentPermissionError):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    if isinstance(exc, PaymentValidationError):
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


@router.get("/teachers/me/payout-profile", response_model=TeacherPayoutProfile)
def get_teacher_payout_profile_endpoint(
    user: AuthUser = Security(get_current_teacher_user),
    db: Session = Depends(get_db),
) -> TeacherPayoutProfile:
    try:
        data = get_teacher_payout_profile_v2(db, user)
    except Exception as exc:
        _handle_payment_error(exc)
    return TeacherPayoutProfile(**data)


@router.patch("/teachers/me/payout-profile", response_model=TeacherPayoutProfile)
def patch_teacher_payout_profile_endpoint(
    payload: TeacherPayoutProfileUpsertRequest,
    user: AuthUser = Security(get_current_teacher_user),
    db: Session = Depends(get_db),
) -> TeacherPayoutProfile:
    try:
        data = _run_write_transaction(db, lambda: upsert_teacher_payout_profile_v2(db, user, payload))
    except Exception as exc:
        _handle_payment_error(exc)
    return TeacherPayoutProfile(**data)


@router.post("/teachers/me/payment-recipient/sync", response_model=TeacherPaymentRecipientSyncResponse)
def post_teacher_payment_recipient_sync_endpoint(
    user: AuthUser = Security(get_current_teacher_user),
    db: Session = Depends(get_db),
) -> TeacherPaymentRecipientSyncResponse:
    try:
        data = _run_write_transaction(db, lambda: sync_teacher_payment_recipient_v2(db, user))
    except Exception as exc:
        _handle_payment_error(exc)
    return TeacherPaymentRecipientSyncResponse(**data)


@router.post("/payments/pagarme/webhook", response_model=PagarmeWebhookResponse)
async def post_pagarme_webhook_endpoint(
    request: Request,
    db: Session = Depends(get_db),
) -> PagarmeWebhookResponse:
    try:
        payload = await request.json()
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid JSON payload.") from exc
    try:
        data = _run_write_transaction(db, lambda: process_pagarme_webhook_v2(db, payload))
    except Exception as exc:
        _handle_payment_error(exc)
    return PagarmeWebhookResponse(**data)
