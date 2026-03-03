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
from app.api.v1.endpoints import admin as admin_endpoints
from app.core.security import AuthUser
from app.db.session import get_db
from app.main import app
from app.services.profile_service import ProfileNotFoundError


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
                    "profile_id": UUID("3472def4-1d03-4350-b2c2-20c7fa27d430"),
                    "full_name": "Ana Silva",
                    "email": "teacher@example.com",
                    "phone": "(11) 99999-9999",
                    "city": "Sao Paulo",
                    "state": "SP",
                    "modality": "online",
                    "hourly_rate": 150.0,
                    "is_active_teacher": True,
                    "created_at": "2026-02-21T10:00:00Z",
                }
            ],
            "parents": [
                {
                    "profile_id": UUID("11111111-1111-1111-1111-111111111111"),
                    "full_name": "Maria Souza",
                    "email": "parent@example.com",
                    "phone": "(11) 98888-7777",
                    "address": "Rua A, 123",
                    "bio": "Bio parent",
                    "children_count": 1,
                    "created_at": "2026-02-20T10:00:00Z",
                }
            ],
            "bookings": [
                {
                    "booking_id": UUID("22222222-2222-2222-2222-222222222222"),
                    "parent_profile_id": UUID("11111111-1111-1111-1111-111111111111"),
                    "parent_name": "Maria Souza",
                    "teacher_profile_id": UUID("3472def4-1d03-4350-b2c2-20c7fa27d430"),
                    "teacher_name": "Ana Silva",
                    "child_id": UUID("33333333-3333-3333-3333-333333333333"),
                    "child_name": "Lucas",
                    "date_iso": "2026-03-10",
                    "time": "14:00",
                    "duration_minutes": 60,
                    "modality": "online",
                    "booking_status": "confirmada",
                    "payment_method": "cartao",
                    "payment_status": "pago",
                    "price_total": 150.0,
                    "currency": "BRL",
                    "created_at": "2026-03-01T10:00:00Z",
                }
            ],
            "payments": [
                {
                    "booking_id": UUID("22222222-2222-2222-2222-222222222222"),
                    "parent_profile_id": UUID("11111111-1111-1111-1111-111111111111"),
                    "parent_name": "Maria Souza",
                    "teacher_profile_id": UUID("3472def4-1d03-4350-b2c2-20c7fa27d430"),
                    "teacher_name": "Ana Silva",
                    "payment_method": "cartao",
                    "payment_status": "pago",
                    "booking_status": "confirmada",
                    "price_total": 150.0,
                    "currency": "BRL",
                    "created_at": "2026-03-01T10:00:00Z",
                    "updated_at": "2026-03-01T10:00:00Z",
                }
            ],
        }

    monkeypatch.setattr(admin_endpoints, "get_admin_dashboard", _fake_get_admin_dashboard)

    response = client.get("/api/v1/admin/dashboard")

    assert response.status_code == 200
    body = response.json()
    assert len(body["teachers"]) == 1
    assert len(body["parents"]) == 1
    assert len(body["bookings"]) == 1
    assert len(body["payments"]) == 1


def test_get_admin_access_returns_ok(client: TestClient) -> None:
    response = client.get("/api/v1/admin/access")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["is_admin"] is True


def test_patch_teacher_activation_returns_ok(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    def _fake_set_teacher_activation(db, profile_id, is_active_teacher):
        return {
            "status": "ok",
            "profile_id": profile_id,
            "is_active_teacher": is_active_teacher,
        }

    monkeypatch.setattr(admin_endpoints, "set_teacher_activation", _fake_set_teacher_activation)

    response = client.patch(
        "/api/v1/admin/teachers/3472def4-1d03-4350-b2c2-20c7fa27d430/activation",
        json={"is_active_teacher": False},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["is_active_teacher"] is False


def test_patch_teacher_activation_not_found_returns_404(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def _fake_set_teacher_activation(db, profile_id, is_active_teacher):
        raise ProfileNotFoundError("Teacher profile not found.")

    monkeypatch.setattr(admin_endpoints, "set_teacher_activation", _fake_set_teacher_activation)

    response = client.patch(
        "/api/v1/admin/teachers/3472def4-1d03-4350-b2c2-20c7fa27d430/activation",
        json={"is_active_teacher": True},
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Teacher profile not found."
