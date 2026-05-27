from collections.abc import Callable
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Security, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.deps import get_current_admin, get_current_user
from app.core.config import get_settings
from app.core.security import AuthUser
from app.db.session import get_db
from app.schemas.v2_notifications import (
    Notification,
    NotificationCreateRequest,
    NotificationDevice,
    NotificationDevicesResponse,
    NotificationDeviceRegisterRequest,
    NotificationDeviceRevokeResponse,
    NotificationMarkReadResponse,
    NotificationPreferencesResponse,
    NotificationPreferencesUpdateRequest,
    NotificationsResponse,
)
from app.services.notification_v2_service import (
    NotificationNotFoundError,
    NotificationValidationError,
    create_notification_v2,
    list_devices_v2,
    list_notifications_v2,
    list_preferences_v2,
    mark_notification_read_v2,
    register_device_v2,
    revoke_device_v2,
    update_preferences_v2,
)

router = APIRouter(tags=["v2-notifications"])


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


def _handle_notification_error(exc: Exception) -> None:
    if isinstance(exc, NotificationNotFoundError):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    if isinstance(exc, NotificationValidationError):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    if isinstance(exc, SQLAlchemyError):
        _raise_http_from_sql_error(exc)
    raise exc


@router.get("/notifications/devices", response_model=NotificationDevicesResponse)
def list_notification_devices_endpoint(
    user: AuthUser = Security(get_current_user),
    db: Session = Depends(get_db),
) -> NotificationDevicesResponse:
    try:
        data = list_devices_v2(db, user)
    except Exception as exc:
        _handle_notification_error(exc)
    return NotificationDevicesResponse(**data)


@router.post("/notifications/devices", response_model=NotificationDevice, status_code=status.HTTP_201_CREATED)
def register_notification_device_endpoint(
    payload: NotificationDeviceRegisterRequest,
    user: AuthUser = Security(get_current_user),
    db: Session = Depends(get_db),
) -> NotificationDevice:
    try:
        data = _run_write_transaction(db, lambda: register_device_v2(db, user, payload))
    except Exception as exc:
        _handle_notification_error(exc)
    return NotificationDevice(**data)


@router.delete("/notifications/devices/{device_id}", response_model=NotificationDeviceRevokeResponse)
def revoke_notification_device_endpoint(
    device_id: UUID,
    user: AuthUser = Security(get_current_user),
    db: Session = Depends(get_db),
) -> NotificationDeviceRevokeResponse:
    try:
        data = _run_write_transaction(db, lambda: revoke_device_v2(db, user, device_id))
    except Exception as exc:
        _handle_notification_error(exc)
    return NotificationDeviceRevokeResponse(**data)


@router.get("/notifications/preferences", response_model=NotificationPreferencesResponse)
def list_notification_preferences_endpoint(
    user: AuthUser = Security(get_current_user),
    db: Session = Depends(get_db),
) -> NotificationPreferencesResponse:
    try:
        data = list_preferences_v2(db, user)
    except Exception as exc:
        _handle_notification_error(exc)
    return NotificationPreferencesResponse(**data)


@router.put("/notifications/preferences", response_model=NotificationPreferencesResponse)
def put_notification_preferences_endpoint(
    payload: NotificationPreferencesUpdateRequest,
    user: AuthUser = Security(get_current_user),
    db: Session = Depends(get_db),
) -> NotificationPreferencesResponse:
    try:
        data = _run_write_transaction(db, lambda: update_preferences_v2(db, user, payload))
    except Exception as exc:
        _handle_notification_error(exc)
    return NotificationPreferencesResponse(**data)


@router.get("/notifications", response_model=NotificationsResponse)
def list_notifications_endpoint(
    notification_status: str | None = Query(default=None, alias="status"),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user: AuthUser = Security(get_current_user),
    db: Session = Depends(get_db),
) -> NotificationsResponse:
    try:
        data = list_notifications_v2(db, user, status=notification_status, limit=limit, offset=offset)
    except Exception as exc:
        _handle_notification_error(exc)
    return NotificationsResponse(**data)


@router.post("/notifications/{notification_id}/read", response_model=NotificationMarkReadResponse)
def mark_notification_read_endpoint(
    notification_id: UUID,
    user: AuthUser = Security(get_current_user),
    db: Session = Depends(get_db),
) -> NotificationMarkReadResponse:
    try:
        data = _run_write_transaction(db, lambda: mark_notification_read_v2(db, user, notification_id))
    except Exception as exc:
        _handle_notification_error(exc)
    return NotificationMarkReadResponse(**data)


@router.post("/admin/notifications", response_model=Notification, status_code=status.HTTP_201_CREATED)
def create_notification_admin_endpoint(
    payload: NotificationCreateRequest,
    _: AuthUser = Security(get_current_admin),
    db: Session = Depends(get_db),
) -> Notification:
    try:
        data = _run_write_transaction(db, lambda: create_notification_v2(db, payload))
    except Exception as exc:
        _handle_notification_error(exc)
    return Notification(**data)
