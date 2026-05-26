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


def test_post_booking_returns_created(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    def _fake_create_booking(db, user, payload):
        return {
            "status": "ok",
            "booking_id": UUID("3472def4-1d03-4350-b2c2-20c7fa27d430"),
            "booking_status": "pendente",
            "payment_order": {
                "id": UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
                "amount_cents": 12000,
                "currency": "BRL",
                "status": "pending",
            },
        }

    monkeypatch.setattr(bookings_endpoints, "create_booking", _fake_create_booking)

    response = client.post(
        "/api/v1/bookings",
        json={
            "teacher_id": "3472def4-1d03-4350-b2c2-20c7fa27d430",
            "child_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            "starts_at": "2026-06-25T14:00:00-03:00",
            "duration_minutes": 60,
            "modality": "online",
            "payment_method": "credit_card",
        },
    )

    assert response.status_code == 201
    assert response.json()["status"] == "ok"
    assert response.json()["booking_status"] == "pendente"


def test_get_parent_agenda_returns_lessons(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    def _fake_get_parent_agenda(db, user, tab, child_id):
        return {
            "lessons": [
                {
                    "id": "3472def4-1d03-4350-b2c2-20c7fa27d430",
                    "parent_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
                    "teacher_id": "3472def4-1d03-4350-b2c2-20c7fa27d430",
                    "teacher_name": "Ana Carolina Silva",
                    "teacher_avatar_url": "https://example.com/avatar.jpg",
                    "skill": "Alfabetizacao",
                    "child_id": "3472def4-1d03-4350-b2c2-20c7fa27d430",
                    "child_name": "Lucas",
                    "starts_at": "2026-06-25T14:00:00Z",
                    "duration_minutes": 60,
                    "modality": "online",
                    "status": "confirmada",
                    "created_at": "2026-02-20T10:00:00Z",
                    "updated_at": "2026-02-20T10:00:00Z",
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


def test_patch_teacher_booking_decision_returns_ok(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def _fake_teacher_decide_booking(db, user, booking_id, payload):
        return {
            "status": "ok",
            "booking_id": UUID("3472def4-1d03-4350-b2c2-20c7fa27d430"),
            "booking_status": "confirmada",
            "updated_at": "2026-02-25T10:00:00Z",
            "cancellation_reason": None,
        }

    monkeypatch.setattr(bookings_endpoints, "teacher_decide_booking", _fake_teacher_decide_booking)

    response = client.patch(
        "/api/v1/bookings/3472def4-1d03-4350-b2c2-20c7fa27d430/teacher/decision",
        json={"action": "accept"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["booking_status"] == "confirmada"


def test_patch_teacher_booking_reschedule_returns_ok(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def _fake_teacher_reschedule_booking(db, user, booking_id, payload):
        return {
            "status": "ok",
            "booking_id": UUID("3472def4-1d03-4350-b2c2-20c7fa27d430"),
            "starts_at": "2026-06-03T16:00:00Z",
            "booking_status": "confirmada",
            "updated_at": "2026-02-25T10:00:00Z",
        }

    monkeypatch.setattr(bookings_endpoints, "teacher_reschedule_booking", _fake_teacher_reschedule_booking)

    response = client.patch(
        "/api/v1/bookings/3472def4-1d03-4350-b2c2-20c7fa27d430/teacher/reschedule",
        json={
            "starts_at": "2026-06-03T16:00:00Z",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["starts_at"] == "2026-06-03T16:00:00Z"


def test_get_teacher_follow_up_context_returns_ok(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def _fake_get_teacher_follow_up_context(db, user, booking_id):
        return {
            "booking_id": UUID("3472def4-1d03-4350-b2c2-20c7fa27d430"),
            "child_id": UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
            "child_name": "Luca",
            "child_birth_month_year": "2017-04-01",
            "starts_at": "2026-06-03T16:00:00Z",
            "duration_minutes": 60,
            "modality": "online",
            "status": "confirmada",
            "completed_lessons_with_child": 1,
            "class_objectives": [
                {
                    "objective": "Reforçar consciência fonológica",
                    "achieved": False,
                    "fullfilment_level": 0,
                }
            ],
            "parent_focus_points": [],
            "activity_plan_source": "fallback",
            "activity_plan": [
                "Revisão ativa do objetivo principal",
                "Atividade prática com dificuldade progressiva",
            ],
        }

    monkeypatch.setattr(bookings_endpoints, "get_teacher_follow_up_context", _fake_get_teacher_follow_up_context)

    response = client.get("/api/v1/bookings/3472def4-1d03-4350-b2c2-20c7fa27d430/teacher/follow-up-context")

    assert response.status_code == 200
    body = response.json()
    assert body["booking_id"] == "3472def4-1d03-4350-b2c2-20c7fa27d430"
    assert body["completed_lessons_with_child"] == 1
    assert len(body["class_objectives"]) == 1


def test_post_booking_review_returns_created(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    def _fake_create_booking_review(db, user, booking_id, payload):
        return {
            "id": UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"),
            "booking_id": booking_id,
            "parent_id": UUID("cccccccc-cccc-cccc-cccc-cccccccccccc"),
            "teacher_id": UUID("dddddddd-dddd-dddd-dddd-dddddddddddd"),
            "rating": payload.rating,
            "comment": payload.comment,
            "feedback": payload.feedback,
            "is_public": payload.is_public,
            "status": "published",
            "submitted_at": "2026-06-03T18:00:00Z",
            "created_at": "2026-06-03T18:00:00Z",
            "updated_at": "2026-06-03T18:00:00Z",
        }

    monkeypatch.setattr(bookings_endpoints, "create_booking_review", _fake_create_booking_review)

    response = client.post(
        "/api/v1/bookings/3472def4-1d03-4350-b2c2-20c7fa27d430/review",
        json={"rating": 5, "comment": "Excelente aula.", "feedback": {"punctuality": 5}},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["rating"] == 5
    assert body["status"] == "published"
