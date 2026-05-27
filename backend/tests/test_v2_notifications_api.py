import os
from contextlib import AbstractContextManager
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("KIDARIO_SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault(
    "KIDARIO_DATABASE_URL",
    "postgresql+psycopg://postgres:postgres@localhost:5432/postgres",
)

from app.api.deps import get_current_admin, get_current_user
from app.api.v2.endpoints import notifications as notifications_endpoints
from app.core.security import AuthUser
from app.db.session import get_db
from app.main import app


NOW = "2026-05-26T10:00:00Z"


class _DummyTransaction(AbstractContextManager[None]):
    def __enter__(self) -> None:
        return None

    def __exit__(self, exc_type, exc, tb) -> bool:
        return False


class _DummySession:
    def begin(self) -> _DummyTransaction:
        return _DummyTransaction()


@pytest.fixture
def client() -> TestClient:
    auth_user = AuthUser(
        user_id="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        email="user@example.com",
        role="authenticated",
    )
    admin_user = AuthUser(
        user_id="bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        email="admin@example.com",
        role="authenticated",
    )
    app.dependency_overrides[get_current_user] = lambda: auth_user
    app.dependency_overrides[get_current_admin] = lambda: admin_user
    app.dependency_overrides[get_db] = lambda: _DummySession()
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def _device() -> dict:
    return {
        "id": UUID("11111111-1111-1111-1111-111111111111"),
        "user_id": UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
        "device_type": "ios",
        "provider": "firebase",
        "push_token": "push-token",
        "app_version": "1.2.3",
        "locale": "pt-BR",
        "timezone": "America/Sao_Paulo",
        "is_active": True,
        "last_seen_at": NOW,
        "revoked_at": None,
        "created_at": NOW,
        "updated_at": NOW,
    }


def _preference() -> dict:
    return {
        "id": UUID("22222222-2222-2222-2222-222222222222"),
        "user_id": UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
        "channel": "push",
        "notification_type": "booking_reminder",
        "is_enabled": True,
        "created_at": NOW,
        "updated_at": NOW,
    }


def _notification() -> dict:
    return {
        "id": UUID("33333333-3333-3333-3333-333333333333"),
        "user_id": UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
        "notification_type": "booking_reminder",
        "channel": "push",
        "title": "Aula em breve",
        "body": "Sua aula comeca em 30 minutos.",
        "payload": {"booking_id": "44444444-4444-4444-4444-444444444444"},
        "status": "queued",
        "created_at": NOW,
        "sent_at": None,
        "read_at": None,
    }


def test_register_list_and_revoke_notification_devices(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(notifications_endpoints, "register_device_v2", lambda db, user, payload: _device())
    monkeypatch.setattr(notifications_endpoints, "list_devices_v2", lambda db, user: {"devices": [_device()]})
    monkeypatch.setattr(
        notifications_endpoints,
        "revoke_device_v2",
        lambda db, user, device_id: {"status": "ok", "device_id": device_id},
    )

    create_response = client.post(
        "/api/v2/notifications/devices",
        json={
            "device_type": "ios",
            "provider": "firebase",
            "push_token": "push-token",
            "app_version": "1.2.3",
            "locale": "pt-BR",
            "timezone": "America/Sao_Paulo",
        },
    )
    list_response = client.get("/api/v2/notifications/devices")
    delete_response = client.delete("/api/v2/notifications/devices/11111111-1111-1111-1111-111111111111")

    assert create_response.status_code == 201
    assert list_response.status_code == 200
    assert delete_response.status_code == 200
    assert create_response.json()["device_type"] == "ios"
    assert list_response.json()["devices"][0]["push_token"] == "push-token"
    assert delete_response.json()["device_id"] == "11111111-1111-1111-1111-111111111111"


def test_get_and_update_notification_preferences(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(notifications_endpoints, "list_preferences_v2", lambda db, user: {"preferences": [_preference()]})
    monkeypatch.setattr(
        notifications_endpoints,
        "update_preferences_v2",
        lambda db, user, payload: {"preferences": [{**_preference(), "is_enabled": payload.preferences[0].is_enabled}]},
    )

    list_response = client.get("/api/v2/notifications/preferences")
    put_response = client.put(
        "/api/v2/notifications/preferences",
        json={
            "preferences": [
                {
                    "channel": "push",
                    "notification_type": "booking_reminder",
                    "is_enabled": False,
                }
            ]
        },
    )

    assert list_response.status_code == 200
    assert put_response.status_code == 200
    assert list_response.json()["preferences"][0]["notification_type"] == "booking_reminder"
    assert put_response.json()["preferences"][0]["is_enabled"] is False


def test_list_mark_read_and_create_admin_notification(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def _fake_list_notifications(db, user, *, status, limit, offset):
        assert status == "queued"
        assert limit == 25
        assert offset == 0
        return {"notifications": [_notification()]}

    monkeypatch.setattr(notifications_endpoints, "list_notifications_v2", _fake_list_notifications)
    monkeypatch.setattr(
        notifications_endpoints,
        "mark_notification_read_v2",
        lambda db, user, notification_id: {
            "status": "ok",
            "notification": {**_notification(), "id": notification_id, "status": "read", "read_at": NOW},
        },
    )
    monkeypatch.setattr(notifications_endpoints, "create_notification_v2", lambda db, payload: _notification())

    list_response = client.get("/api/v2/notifications?status=queued&limit=25")
    read_response = client.post("/api/v2/notifications/33333333-3333-3333-3333-333333333333/read")
    create_response = client.post(
        "/api/v2/admin/notifications",
        json={
            "user_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            "notification_type": "booking_reminder",
            "channel": "push",
            "title": "Aula em breve",
            "body": "Sua aula comeca em 30 minutos.",
            "payload": {"booking_id": "44444444-4444-4444-4444-444444444444"},
        },
    )

    assert list_response.status_code == 200
    assert read_response.status_code == 200
    assert create_response.status_code == 201
    assert list_response.json()["notifications"][0]["payload"]["booking_id"] == "44444444-4444-4444-4444-444444444444"
    assert read_response.json()["notification"]["status"] == "read"
    assert create_response.json()["title"] == "Aula em breve"
