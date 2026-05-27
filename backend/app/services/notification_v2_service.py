import json
from uuid import UUID, uuid4

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.security import AuthUser
from app.schemas.v2_notifications import (
    NotificationCreateRequest,
    NotificationDeviceRegisterRequest,
    NotificationPreferencesUpdateRequest,
)


class NotificationValidationError(Exception):
    pass


class NotificationNotFoundError(Exception):
    pass


def _map_device(row: dict) -> dict:
    return {
        "id": row["id"],
        "user_id": row["user_id"],
        "device_type": row["device_type"],
        "provider": row["provider"],
        "push_token": row["push_token"],
        "app_version": row["app_version"],
        "locale": row["locale"],
        "timezone": row["timezone"],
        "is_active": row["is_active"],
        "last_seen_at": row["last_seen_at"],
        "revoked_at": row["revoked_at"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def _map_notification(row: dict) -> dict:
    return {
        "id": row["id"],
        "user_id": row["user_id"],
        "notification_type": row["notification_type"],
        "channel": row["channel"],
        "title": row["title"],
        "body": row["body"],
        "payload": row["payload"],
        "status": row["status"],
        "created_at": row["created_at"],
        "sent_at": row["sent_at"],
        "read_at": row["read_at"],
    }


def _device_type_id(db: Session, code: str) -> int:
    value = db.execute(
        text("select id from notification_device_types where code = :code"),
        {"code": code},
    ).scalar()
    if value is None:
        raise NotificationValidationError(f"Unsupported device type: {code}.")
    return int(value)


def list_devices_v2(db: Session, user: AuthUser) -> dict:
    rows = (
        db.execute(
            text(
                """
                select
                  nd.id,
                  nd.user_id,
                  ndt.code as device_type,
                  nd.provider,
                  nd.push_token,
                  nd.app_version,
                  nd.locale,
                  nd.timezone,
                  nd.is_active,
                  nd.last_seen_at,
                  nd.revoked_at,
                  nd.created_at,
                  nd.updated_at
                from notification_devices nd
                join notification_device_types ndt on ndt.id = nd.device_type_id
                where nd.user_id = :user_id
                order by nd.updated_at desc
                """
            ),
            {"user_id": user.user_id},
        )
        .mappings()
        .all()
    )
    return {"devices": [_map_device(dict(row)) for row in rows]}


def register_device_v2(db: Session, user: AuthUser, payload: NotificationDeviceRegisterRequest) -> dict:
    device_type_id = _device_type_id(db, payload.device_type)
    row = (
        db.execute(
            text(
                """
                insert into notification_devices (
                  id,
                  user_id,
                  device_type_id,
                  provider,
                  push_token,
                  app_version,
                  locale,
                  timezone,
                  is_active,
                  last_seen_at,
                  revoked_at
                )
                values (
                  :id,
                  :user_id,
                  :device_type_id,
                  :provider,
                  :push_token,
                  :app_version,
                  :locale,
                  :timezone,
                  true,
                  now(),
                  null
                )
                on conflict (push_token) do update
                set user_id = excluded.user_id,
                    device_type_id = excluded.device_type_id,
                    provider = excluded.provider,
                    app_version = excluded.app_version,
                    locale = excluded.locale,
                    timezone = excluded.timezone,
                    is_active = true,
                    last_seen_at = now(),
                    revoked_at = null,
                    updated_at = now()
                returning id
                """
            ),
            {
                "id": str(uuid4()),
                "user_id": user.user_id,
                "device_type_id": device_type_id,
                "provider": payload.provider,
                "push_token": payload.push_token,
                "app_version": payload.app_version,
                "locale": payload.locale,
                "timezone": payload.timezone,
            },
        )
        .mappings()
        .first()
    )
    return get_device_v2(db, user, UUID(str(row["id"])))


def get_device_v2(db: Session, user: AuthUser, device_id: UUID) -> dict:
    row = (
        db.execute(
            text(
                """
                select
                  nd.id,
                  nd.user_id,
                  ndt.code as device_type,
                  nd.provider,
                  nd.push_token,
                  nd.app_version,
                  nd.locale,
                  nd.timezone,
                  nd.is_active,
                  nd.last_seen_at,
                  nd.revoked_at,
                  nd.created_at,
                  nd.updated_at
                from notification_devices nd
                join notification_device_types ndt on ndt.id = nd.device_type_id
                where nd.id = :device_id
                  and nd.user_id = :user_id
                """
            ),
            {"device_id": str(device_id), "user_id": user.user_id},
        )
        .mappings()
        .first()
    )
    if not row:
        raise NotificationNotFoundError("Notification device not found.")
    return _map_device(dict(row))


def revoke_device_v2(db: Session, user: AuthUser, device_id: UUID) -> dict:
    revoked = db.execute(
        text(
            """
            update notification_devices
            set is_active = false,
                revoked_at = now(),
                updated_at = now()
            where id = :device_id
              and user_id = :user_id
            returning id
            """
        ),
        {"device_id": str(device_id), "user_id": user.user_id},
    ).scalar()
    if not revoked:
        raise NotificationNotFoundError("Notification device not found.")
    return {"status": "ok", "device_id": UUID(str(revoked))}


def list_preferences_v2(db: Session, user: AuthUser) -> dict:
    rows = (
        db.execute(
            text(
                """
                select id, user_id, channel, notification_type, is_enabled, created_at, updated_at
                from notification_preferences
                where user_id = :user_id
                order by channel asc, notification_type asc
                """
            ),
            {"user_id": user.user_id},
        )
        .mappings()
        .all()
    )
    return {"preferences": [dict(row) for row in rows]}


def update_preferences_v2(db: Session, user: AuthUser, payload: NotificationPreferencesUpdateRequest) -> dict:
    for preference in payload.preferences:
        db.execute(
            text(
                """
                insert into notification_preferences (
                  id, user_id, channel, notification_type, is_enabled
                )
                values (
                  :id, :user_id, :channel, :notification_type, :is_enabled
                )
                on conflict (user_id, channel, notification_type) do update
                set is_enabled = excluded.is_enabled,
                    updated_at = now()
                """
            ),
            {
                "id": str(uuid4()),
                "user_id": user.user_id,
                "channel": preference.channel,
                "notification_type": preference.notification_type,
                "is_enabled": preference.is_enabled,
            },
        )
    return list_preferences_v2(db, user)


def list_notifications_v2(
    db: Session,
    user: AuthUser,
    *,
    status: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> dict:
    where = ["user_id = :user_id"]
    params: dict[str, object] = {"user_id": user.user_id, "limit": limit, "offset": offset}
    if status:
        where.append("status = :status")
        params["status"] = status
    rows = (
        db.execute(
            text(
                f"""
                select id, user_id, notification_type, channel, title, body, payload, status, created_at, sent_at, read_at
                from notifications
                where {' and '.join(where)}
                order by created_at desc
                limit :limit
                offset :offset
                """
            ),
            params,
        )
        .mappings()
        .all()
    )
    return {"notifications": [_map_notification(dict(row)) for row in rows]}


def mark_notification_read_v2(db: Session, user: AuthUser, notification_id: UUID) -> dict:
    row = (
        db.execute(
            text(
                """
                update notifications
                set status = 'read',
                    read_at = coalesce(read_at, now())
                where id = :notification_id
                  and user_id = :user_id
                returning id, user_id, notification_type, channel, title, body, payload, status, created_at, sent_at, read_at
                """
            ),
            {"notification_id": str(notification_id), "user_id": user.user_id},
        )
        .mappings()
        .first()
    )
    if not row:
        raise NotificationNotFoundError("Notification not found.")
    return {"status": "ok", "notification": _map_notification(dict(row))}


def create_notification_v2(db: Session, payload: NotificationCreateRequest) -> dict:
    row = (
        db.execute(
            text(
                """
                insert into notifications (
                  id, user_id, notification_type, channel, title, body, payload, status
                )
                values (
                  :id, :user_id, :notification_type, :channel, :title, :body, cast(:payload as jsonb), :status
                )
                returning id, user_id, notification_type, channel, title, body, payload, status, created_at, sent_at, read_at
                """
            ),
            {
                "id": str(uuid4()),
                "user_id": str(payload.user_id),
                "notification_type": payload.notification_type,
                "channel": payload.channel,
                "title": payload.title,
                "body": payload.body,
                "payload": json.dumps(payload.payload or {}),
                "status": payload.status,
            },
        )
        .mappings()
        .first()
    )
    return _map_notification(dict(row))
