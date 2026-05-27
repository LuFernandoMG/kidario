from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


DeviceTypeCode = Literal["ios", "android", "web"]
NotificationProvider = Literal["firebase", "expo", "apns"]
NotificationChannel = Literal["push", "email", "sms"]
NotificationType = Literal[
    "booking_created",
    "booking_confirmed",
    "booking_canceled",
    "booking_reminder",
    "payment_paid",
    "payment_failed",
    "package_activated",
    "package_low_credits",
    "chat_message",
]
NotificationStatus = Literal["queued", "sent", "failed", "read"]


class NotificationDevice(BaseModel):
    id: UUID
    user_id: UUID
    device_type: DeviceTypeCode
    provider: NotificationProvider
    push_token: str
    app_version: str | None = None
    locale: str | None = None
    timezone: str | None = None
    is_active: bool
    last_seen_at: datetime | None = None
    revoked_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class NotificationDevicesResponse(BaseModel):
    devices: list[NotificationDevice]


class NotificationDeviceRegisterRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    device_type: DeviceTypeCode
    provider: NotificationProvider
    push_token: str = Field(min_length=1)
    app_version: str | None = None
    locale: str | None = None
    timezone: str | None = None


class NotificationDeviceRevokeResponse(BaseModel):
    status: str = "ok"
    device_id: UUID


class NotificationPreference(BaseModel):
    id: UUID
    user_id: UUID
    channel: NotificationChannel
    notification_type: NotificationType
    is_enabled: bool
    created_at: datetime
    updated_at: datetime


class NotificationPreferencesResponse(BaseModel):
    preferences: list[NotificationPreference]


class NotificationPreferenceUpsert(BaseModel):
    model_config = ConfigDict(extra="forbid")

    channel: NotificationChannel
    notification_type: NotificationType
    is_enabled: bool


class NotificationPreferencesUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    preferences: list[NotificationPreferenceUpsert] = Field(min_length=1)


class Notification(BaseModel):
    id: UUID
    user_id: UUID
    notification_type: str
    channel: NotificationChannel
    title: str | None = None
    body: str | None = None
    payload: dict[str, Any] | None = None
    status: NotificationStatus
    created_at: datetime
    sent_at: datetime | None = None
    read_at: datetime | None = None


class NotificationsResponse(BaseModel):
    notifications: list[Notification]


class NotificationMarkReadResponse(BaseModel):
    status: str = "ok"
    notification: Notification


class NotificationCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    user_id: UUID
    notification_type: NotificationType
    channel: NotificationChannel
    title: str | None = None
    body: str | None = None
    payload: dict[str, Any] | None = None
    status: NotificationStatus = "queued"

    @model_validator(mode="after")
    def ensure_message_has_content(self) -> "NotificationCreateRequest":
        if not self.title and not self.body:
            raise ValueError("Notification must include title or body.")
        return self
