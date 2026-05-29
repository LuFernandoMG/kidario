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
from app.api.v2.endpoints import bookings as bookings_endpoints
from app.api.v2.endpoints import reviews as reviews_endpoints
from app.core.security import AuthUser
from app.db.session import get_db
from app.main import app
from app.services.booking_v2_service import BookingConflictError, BookingNotFoundError


NOW = "2026-02-20T10:00:00Z"
BOOKING_ID = UUID("3472def4-1d03-4350-b2c2-20c7fa27d430")
PARENT_ID = UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
TEACHER_ID = UUID("cccccccc-cccc-cccc-cccc-cccccccccccc")
CHILD_ID = UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")


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


def _payment_order() -> dict:
    return {
        "id": UUID("dddddddd-dddd-dddd-dddd-dddddddddddd"),
        "parent_id": PARENT_ID,
        "booking_id": BOOKING_ID,
        "package_id": None,
        "provider": "internal",
        "provider_order_id": None,
        "provider_order_code": None,
        "amount_cents": 12000,
        "currency": "BRL",
        "status": "pending",
        "charges": [
            {
                "id": UUID("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee"),
                "payment_order_id": UUID("dddddddd-dddd-dddd-dddd-dddddddddddd"),
                "provider": "internal",
                "provider_charge_id": None,
                "provider_transaction_id": None,
                "payment_method": "credit_card",
                "status": "pending",
                "amount_cents": 12000,
                "paid_amount_cents": None,
                "installments": 1,
                "pix_qr_code_url": None,
                "boleto_url": None,
                "paid_at": None,
                "failed_at": None,
                "canceled_at": None,
                "refunded_at": None,
                "created_at": NOW,
                "updated_at": NOW,
            }
        ],
        "created_at": NOW,
        "updated_at": NOW,
    }


def _booking(status: str = "pendente", starts_at: str = "2026-06-25T14:00:00Z") -> dict:
    return {
        "id": BOOKING_ID,
        "parent_id": PARENT_ID,
        "child_id": CHILD_ID,
        "teacher_id": TEACHER_ID,
        "package_id": None,
        "starts_at": starts_at,
        "duration_minutes": 60,
        "modality": "online",
        "status": status,
        "teacher_decision_status": "pending",
        "teacher_decision_reason": None,
        "teacher_decision_at": None,
        "payment_flow_status": "authorized",
        "cancellation_reason": None,
        "confirmed_at": "2026-02-25T10:00:00Z" if status == "confirmada" else None,
        "completed_at": None,
        "canceled_at": None,
        "created_at": NOW,
        "updated_at": NOW,
        "child": {"id": CHILD_ID, "name": "Lucas"},
        "teacher": {"id": TEACHER_ID, "display_name": "Ana Carolina Silva", "profile_photo_url": None},
        "parent": {"id": PARENT_ID, "display_name": "Maria Souza"},
        "payment_order": _payment_order(),
        "latest_follow_up": None,
        "actions": {
            "can_reschedule": True,
            "can_cancel": True,
            "can_complete": False,
            "can_review": False,
        },
    }


def test_post_booking_returns_created(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(bookings_endpoints, "create_booking_v2", lambda db, user, payload: _booking())

    response = client.post(
        "/api/v2/bookings",
        json={
            "teacher_id": str(TEACHER_ID),
            "child_id": str(CHILD_ID),
            "starts_at": "2026-06-25T14:00:00-03:00",
            "duration_minutes": 60,
            "modality": "online",
            "payment_method": "credit_card",
            "card_token": "card_token_test",
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["id"] == str(BOOKING_ID)
    assert body["status"] == "pendente"
    assert body["payment_order"]["amount_cents"] == 12000


def test_get_parent_bookings_returns_lessons(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    def _fake_list_parent_bookings_v2(db, user, tab, status, child_id, limit, offset):
        return {"bookings": [_booking(status="confirmada")]}

    monkeypatch.setattr(bookings_endpoints, "list_parent_bookings_v2", _fake_list_parent_bookings_v2)

    response = client.get("/api/v2/parents/me/bookings?tab=upcoming")

    assert response.status_code == 200
    body = response.json()
    assert "bookings" in body
    assert body["bookings"][0]["teacher"]["display_name"] == "Ana Carolina Silva"


def test_get_booking_detail_not_found_returns_404(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def _fake_get_booking_v2(db, user, booking_id):
        raise BookingNotFoundError("Booking not found.")

    monkeypatch.setattr(bookings_endpoints, "get_booking_v2", _fake_get_booking_v2)

    response = client.get(f"/api/v2/bookings/{BOOKING_ID}")

    assert response.status_code == 404
    assert response.json()["detail"] == "Booking not found."


def test_post_booking_cancel_conflict_returns_409(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def _fake_cancel_booking_v2(db, user, booking_id, payload):
        raise BookingConflictError("Booking cannot be cancelled in the current status.")

    monkeypatch.setattr(bookings_endpoints, "cancel_booking_v2", _fake_cancel_booking_v2)

    response = client.post(
        f"/api/v2/bookings/{BOOKING_ID}/cancel",
        json={"reason": "Imprevisto familiar"},
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "Booking cannot be cancelled in the current status."


def test_post_teacher_booking_decision_returns_ok(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        bookings_endpoints,
        "decide_booking_v2",
        lambda db, user, booking_id, payload: _booking(status="confirmada"),
    )

    response = client.post(
        f"/api/v2/bookings/{BOOKING_ID}/decision",
        json={"decision": "accept"},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "confirmada"


def test_patch_teacher_booking_reschedule_returns_ok(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        bookings_endpoints,
        "teacher_reschedule_booking_v2",
        lambda db, user, booking_id, payload: _booking(status="confirmada", starts_at="2026-06-03T16:00:00Z"),
    )

    response = client.patch(
        f"/api/v2/bookings/{BOOKING_ID}/teacher/reschedule",
        json={"starts_at": "2026-06-03T16:00:00Z"},
    )

    assert response.status_code == 200
    assert response.json()["starts_at"] == "2026-06-03T16:00:00Z"


def test_get_teacher_follow_up_context_returns_ok(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def _fake_get_teacher_follow_up_context_v2(db, user, booking_id):
        return {
            "booking_id": BOOKING_ID,
            "child_id": CHILD_ID,
            "child_name": "Luca",
            "child_birth_month_year": "2017-04-01",
            "starts_at": "2026-06-03T16:00:00Z",
            "duration_minutes": 60,
            "modality": "online",
            "status": "confirmada",
            "completed_lessons_with_child": 1,
            "class_objectives": [{"objective": "Reforçar consciência fonológica", "achieved": False, "fullfilment_level": 0}],
            "parent_focus_points": [],
            "activity_plan_source": "fallback",
            "activity_plan": ["Revisão ativa do objetivo principal", "Atividade prática com dificuldade progressiva"],
        }

    monkeypatch.setattr(
        bookings_endpoints,
        "get_teacher_follow_up_context_v2",
        _fake_get_teacher_follow_up_context_v2,
    )

    response = client.get(f"/api/v2/bookings/{BOOKING_ID}/teacher/follow-up-context")

    assert response.status_code == 200
    body = response.json()
    assert body["booking_id"] == str(BOOKING_ID)
    assert body["completed_lessons_with_child"] == 1


def test_post_booking_review_returns_created(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    def _fake_create_review_v2(db, user, booking_id, payload):
        return {
            "id": UUID("ffffffff-ffff-ffff-ffff-ffffffffffff"),
            "booking_id": booking_id,
            "parent_id": PARENT_ID,
            "teacher_id": TEACHER_ID,
            "rating": payload.rating,
            "comment": payload.comment,
            "feedback": payload.feedback,
            "is_public": payload.is_public,
            "status": "published",
            "submitted_at": "2026-06-03T18:00:00Z",
            "created_at": "2026-06-03T18:00:00Z",
            "updated_at": "2026-06-03T18:00:00Z",
        }

    monkeypatch.setattr(reviews_endpoints, "create_review_v2", _fake_create_review_v2)

    response = client.post(
        f"/api/v2/bookings/{BOOKING_ID}/review",
        json={"rating": 5, "comment": "Excelente aula.", "feedback": {"punctuality": 5}},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["rating"] == 5
    assert body["status"] == "published"
