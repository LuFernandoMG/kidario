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

from app.api.deps import get_current_teacher_user, get_current_user
from app.api.v1.endpoints import chat as chat_endpoints
from app.api.v1.endpoints import teacher_control as teacher_control_endpoints
from app.core.security import AuthUser
from app.db.session import get_db
from app.main import app


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
    current_user = AuthUser(
        user_id="3472def4-1d03-4350-b2c2-20c7fa27d430",
        email="hello@luisfernando.io",
        role="authenticated",
    )
    app.dependency_overrides[get_current_user] = lambda: current_user
    app.dependency_overrides[get_current_teacher_user] = lambda: current_user
    app.dependency_overrides[get_db] = lambda: _DummySession()

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


def test_get_teacher_control_center_overview_returns_ok(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def _fake_get_teacher_control_center_overview(db, user, limit_agenda, limit_chats, limit_students):
        return {
            "generated_at": "2026-02-25T10:00:00Z",
            "upcoming_lessons_count": 3,
            "pending_decisions_count": 1,
            "agenda": [
                {
                    "id": UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
                    "child_id": UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"),
                    "child_name": "Luca",
                    "parent_profile_id": UUID("cccccccc-cccc-cccc-cccc-cccccccccccc"),
                    "date_iso": "2026-02-27",
                    "date_label": "27/02/2026",
                    "time": "10:00",
                    "duration_minutes": 60,
                    "modality": "online",
                    "status": "pendente",
                    "chat_thread_id": None,
                    "actions": {
                        "can_accept": True,
                        "can_reject": True,
                        "can_reschedule": True,
                        "can_open_chat": True,
                        "can_complete": False,
                    },
                }
            ],
            "chat_threads": [],
            "students": [],
            "finance": {
                "currency": "BRL",
                "gross_revenue_total": 0,
                "paid_total": 0,
                "pending_payment_total": 0,
                "completed_lessons_count": 0,
                "paid_lessons_count": 0,
            },
            "planning": {
                "window_start": "2026-02-25",
                "window_end": "2026-03-11",
                "available_slots_count": 10,
                "upcoming_lessons_count": 3,
                "occupancy_rate_percent": 30.0,
            },
        }

    monkeypatch.setattr(
        teacher_control_endpoints,
        "get_teacher_control_center_overview",
        _fake_get_teacher_control_center_overview,
    )

    response = client.get("/api/v1/teacher/control-center/overview")

    assert response.status_code == 200
    body = response.json()
    assert body["upcoming_lessons_count"] == 3
    assert body["pending_decisions_count"] == 1
    assert len(body["agenda"]) == 1


def test_get_chat_threads_returns_ok(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def _fake_list_threads(db, user, limit, booking_status=None):
        return {
            "threads": [
                {
                    "id": UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
                    "booking_id": UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"),
                    "parent_profile_id": UUID("cccccccc-cccc-cccc-cccc-cccccccccccc"),
                    "teacher_profile_id": UUID("3472def4-1d03-4350-b2c2-20c7fa27d430"),
                    "child_id": UUID("dddddddd-dddd-dddd-dddd-dddddddddddd"),
                    "booking_status": "confirmada",
                    "parent_name": "Parent Name",
                    "teacher_name": "Teacher Name",
                    "child_name": "Luca",
                    "created_at": "2026-02-20T10:00:00Z",
                    "updated_at": "2026-02-25T10:00:00Z",
                    "last_message_at": "2026-02-25T11:00:00Z",
                }
            ]
        }

    monkeypatch.setattr(chat_endpoints, "list_threads", _fake_list_threads)

    response = client.get("/api/v1/chat/threads?limit=20")

    assert response.status_code == 200
    body = response.json()
    assert len(body["threads"]) == 1
    assert body["threads"][0]["child_name"] == "Luca"
