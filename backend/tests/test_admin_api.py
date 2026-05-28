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

from app.api.deps import get_current_admin
from app.api.v2.endpoints import admin as admin_endpoints
from app.api.v2.endpoints import reviews as reviews_endpoints
from app.core.security import AuthUser
from app.db.session import get_db
from app.main import app
from app.services.profile_v2_service import ProfileNotFoundError


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
    app.dependency_overrides[get_current_admin] = lambda: AuthUser(
        user_id="3472def4-1d03-4350-b2c2-20c7fa27d430",
        email="admin@kidario.com",
        role="authenticated",
    )
    app.dependency_overrides[get_db] = lambda: _DummySession()

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


def test_get_admin_dashboard_returns_all_tables(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    def _fake_get_admin_dashboard(db):
        return {
            "teachers": [
                {
                    "teacher_id": UUID("3472def4-1d03-4350-b2c2-20c7fa27d430"),
                    "user_id": UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
                    "full_name": "Ana Silva",
                    "email": "teacher@example.com",
                    "phone": "(11) 99999-9999",
                    "city": "Sao Paulo",
                    "state": "SP",
                    "modality": "online",
                    "hourly_rate_cents": 15000,
                    "academic_records": [],
                    "experiences": [],
                    "is_active": True,
                    "created_at": "2026-02-21T10:00:00Z",
                }
            ],
            "parents": [
                {
                    "parent_id": UUID("11111111-1111-1111-1111-111111111111"),
                    "user_id": UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"),
                    "full_name": "Maria Souza",
                    "email": "parent@example.com",
                    "phone": "(11) 98888-7777",
                    "city": "Sao Paulo",
                    "state": "SP",
                    "bio": "Bio parent",
                    "children_count": 1,
                    "created_at": "2026-02-20T10:00:00Z",
                }
            ],
            "bookings": [
                {
                    "booking_id": UUID("22222222-2222-2222-2222-222222222222"),
                    "parent_id": UUID("11111111-1111-1111-1111-111111111111"),
                    "parent_name": "Maria Souza",
                    "teacher_id": UUID("3472def4-1d03-4350-b2c2-20c7fa27d430"),
                    "teacher_name": "Ana Silva",
                    "child_id": UUID("33333333-3333-3333-3333-333333333333"),
                    "child_name": "Lucas",
                    "starts_at": "2026-03-10T14:00:00Z",
                    "duration_minutes": 60,
                    "modality": "online",
                    "booking_status": "confirmada",
                    "amount_cents": 15000,
                    "currency": "BRL",
                    "created_at": "2026-03-01T10:00:00Z",
                }
            ],
            "payments": [
                {
                    "payment_order_id": UUID("44444444-4444-4444-4444-444444444444"),
                    "booking_id": UUID("22222222-2222-2222-2222-222222222222"),
                    "package_id": None,
                    "parent_id": UUID("11111111-1111-1111-1111-111111111111"),
                    "parent_name": "Maria Souza",
                    "teacher_id": UUID("3472def4-1d03-4350-b2c2-20c7fa27d430"),
                    "teacher_name": "Ana Silva",
                    "payment_method": "credit_card",
                    "payment_status": "paid",
                    "booking_status": "confirmada",
                    "amount_cents": 15000,
                    "currency": "BRL",
                    "created_at": "2026-03-01T10:00:00Z",
                    "updated_at": "2026-03-01T10:00:00Z",
                }
            ],
            "reviews": [],
        }

    monkeypatch.setattr(admin_endpoints, "get_admin_dashboard", _fake_get_admin_dashboard)

    response = client.get("/api/v2/admin/dashboard")

    assert response.status_code == 200
    body = response.json()
    assert len(body["teachers"]) == 1
    assert len(body["parents"]) == 1
    assert len(body["bookings"]) == 1
    assert len(body["payments"]) == 1


def test_get_admin_access_returns_ok(client: TestClient) -> None:
    response = client.get("/api/v2/admin/access")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["is_admin"] is True


def test_patch_teacher_activation_returns_ok(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    def _fake_set_teacher_activation(db, teacher_id, is_active):
        return {
            "status": "ok",
            "teacher_id": teacher_id,
            "is_active": is_active,
        }

    monkeypatch.setattr(admin_endpoints, "set_teacher_activation_v2", _fake_set_teacher_activation)

    response = client.patch(
        "/api/v2/admin/teachers/3472def4-1d03-4350-b2c2-20c7fa27d430/activation",
        json={"is_active": False},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["is_active"] is False


def test_patch_teacher_activation_not_found_returns_404(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def _fake_set_teacher_activation(db, teacher_id, is_active):
        raise ProfileNotFoundError("Teacher not found.")

    monkeypatch.setattr(admin_endpoints, "set_teacher_activation_v2", _fake_set_teacher_activation)

    response = client.patch(
        "/api/v2/admin/teachers/3472def4-1d03-4350-b2c2-20c7fa27d430/activation",
        json={"is_active": True},
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Teacher not found."


def test_get_admin_reviews_returns_reviews(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    def _fake_list_admin_reviews(db, status, teacher_id, parent_id, booking_id, limit, offset):
        assert status == "reported"
        return {
            "reviews": [
                {
                    "id": UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
                    "booking_id": UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"),
                    "parent_id": UUID("cccccccc-cccc-cccc-cccc-cccccccccccc"),
                    "teacher_id": UUID("dddddddd-dddd-dddd-dddd-dddddddddddd"),
                    "rating": 4,
                    "comment": "Bom acompanhamento.",
                    "feedback": {},
                    "is_public": True,
                    "status": "reported",
                    "submitted_at": "2026-06-03T18:00:00Z",
                    "created_at": "2026-06-03T18:00:00Z",
                    "updated_at": "2026-06-03T18:00:00Z",
                }
            ]
        }

    monkeypatch.setattr(reviews_endpoints, "list_admin_reviews_v2", _fake_list_admin_reviews)

    response = client.get("/api/v2/admin/reviews?status=reported")

    assert response.status_code == 200
    assert response.json()["reviews"][0]["status"] == "reported"


def test_patch_admin_review_returns_review(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    def _fake_moderate_review(db, review_id, payload):
        return {
            "id": review_id,
            "booking_id": UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"),
            "parent_id": UUID("cccccccc-cccc-cccc-cccc-cccccccccccc"),
            "teacher_id": UUID("dddddddd-dddd-dddd-dddd-dddddddddddd"),
            "rating": 4,
            "comment": "Bom acompanhamento.",
            "feedback": {},
            "is_public": payload.is_public,
            "status": payload.status,
            "submitted_at": "2026-06-03T18:00:00Z",
            "created_at": "2026-06-03T18:00:00Z",
            "updated_at": "2026-06-03T18:00:00Z",
        }

    monkeypatch.setattr(reviews_endpoints, "moderate_review_v2", _fake_moderate_review)

    response = client.patch(
        "/api/v2/admin/reviews/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        json={"status": "hidden", "is_public": False},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "hidden"
    assert body["is_public"] is False
