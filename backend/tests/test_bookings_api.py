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

from app.api.deps import get_current_user
from app.api.v1.endpoints import bookings as bookings_endpoints
from app.core.security import AuthUser
from app.db.session import get_db
from app.main import app
from app.services.booking_service import BookingConflictError, BookingNotFoundError


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
    app.dependency_overrides[get_current_user] = lambda: AuthUser(
        user_id="3472def4-1d03-4350-b2c2-20c7fa27d430",
        email="hello@luisfernando.io",
        role="authenticated",
    )
    app.dependency_overrides[get_db] = lambda: _DummySession()

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


def test_post_booking_returns_created(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    def _fake_create_booking(db, user, payload):
        return {
            "status": "ok",
            "booking_id": UUID("3472def4-1d03-4350-b2c2-20c7fa27d430"),
            "booking_status": "confirmada",
            "payment_status": "pago",
        }

    monkeypatch.setattr(bookings_endpoints, "create_booking", _fake_create_booking)

    response = client.post(
        "/api/v1/bookings",
        json={
            "teacher_profile_id": "3472def4-1d03-4350-b2c2-20c7fa27d430",
            "date_iso": "2026-02-25",
            "time": "14:00",
            "duration_minutes": 60,
            "modality": "online",
            "payment_method": "cartao",
        },
    )

    assert response.status_code == 201
    assert response.json()["status"] == "ok"
    assert response.json()["booking_status"] == "confirmada"


def test_get_parent_agenda_returns_lessons(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    def _fake_get_parent_agenda(db, user, tab, child_id):
        return {
            "lessons": [
                {
                    "id": "3472def4-1d03-4350-b2c2-20c7fa27d430",
                    "teacher_id": "3472def4-1d03-4350-b2c2-20c7fa27d430",
                    "teacher_name": "Ana Carolina Silva",
                    "teacher_avatar_url": "https://example.com/avatar.jpg",
                    "specialty": "Alfabetizacao",
                    "child_id": "3472def4-1d03-4350-b2c2-20c7fa27d430",
                    "child_name": "Lucas",
                    "date_iso": "2026-02-25",
                    "date_label": "25/02/2026",
                    "time": "14:00",
                    "modality": "online",
                    "status": "confirmada",
                    "created_at_iso": "2026-02-20T10:00:00Z",
                    "updated_at_iso": "2026-02-20T10:00:00Z",
                }
            ]
        }

    monkeypatch.setattr(bookings_endpoints, "get_parent_agenda", _fake_get_parent_agenda)

    response = client.get("/api/v1/bookings/parent/agenda?tab=upcoming")

    assert response.status_code == 200
    body = response.json()
    assert "lessons" in body
    assert isinstance(body["lessons"], list)
    assert body["lessons"][0]["teacher_name"] == "Ana Carolina Silva"


def test_get_booking_detail_not_found_returns_404(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def _fake_get_booking_detail(db, user, booking_id):
        raise BookingNotFoundError("Booking not found.")

    monkeypatch.setattr(bookings_endpoints, "get_booking_detail", _fake_get_booking_detail)

    response = client.get("/api/v1/bookings/3472def4-1d03-4350-b2c2-20c7fa27d430")

    assert response.status_code == 404
    assert response.json()["detail"] == "Booking not found."


def test_patch_booking_cancel_conflict_returns_409(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def _fake_cancel_booking(db, user, booking_id, payload):
        raise BookingConflictError("Booking cannot be cancelled in the current status.")

    monkeypatch.setattr(bookings_endpoints, "cancel_booking", _fake_cancel_booking)

    response = client.patch(
        "/api/v1/bookings/3472def4-1d03-4350-b2c2-20c7fa27d430/cancel",
        json={"reason": "Imprevisto familiar"},
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "Booking cannot be cancelled in the current status."
