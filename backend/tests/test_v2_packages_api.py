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
from app.api.v2.endpoints import packages as packages_endpoints
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
    app.dependency_overrides[get_current_user] = lambda: auth_user
    app.dependency_overrides[get_current_teacher_user] = lambda: auth_user
    app.dependency_overrides[get_db] = lambda: _DummySession()
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def _payment_order() -> dict:
    return {
        "id": UUID("55555555-5555-5555-5555-555555555555"),
        "parent_id": UUID("11111111-1111-1111-1111-111111111111"),
        "booking_id": None,
        "package_id": UUID("77777777-7777-7777-7777-777777777777"),
        "provider": "legacy",
        "provider_order_id": None,
        "provider_order_code": None,
        "amount_cents": 43200,
        "currency": "BRL",
        "status": "pending",
        "charges": [],
        "created_at": NOW,
        "updated_at": NOW,
    }


def _package_plan() -> dict:
    return {
        "id": UUID("33333333-3333-3333-3333-333333333333"),
        "teacher_id": UUID("22222222-2222-2222-2222-222222222222"),
        "code": "PACK4",
        "name": "Pacote 4 aulas",
        "description": "Quatro encontros.",
        "sessions_count": 4,
        "discount_percent": 10,
        "is_active": True,
        "estimated_original_amount_cents": 48000,
        "estimated_final_amount_cents": 43200,
        "currency": "BRL",
        "created_at": NOW,
        "updated_at": NOW,
    }


def _booking_package() -> dict:
    return {
        "id": UUID("77777777-7777-7777-7777-777777777777"),
        "package_plan_id": UUID("33333333-3333-3333-3333-333333333333"),
        "teacher_id": UUID("22222222-2222-2222-2222-222222222222"),
        "parent_id": UUID("11111111-1111-1111-1111-111111111111"),
        "child_id": UUID("44444444-4444-4444-4444-444444444444"),
        "total_sessions": 4,
        "booked_sessions": 0,
        "completed_sessions": 0,
        "remaining_sessions": 4,
        "original_unit_amount_cents": 12000,
        "original_amount_cents": 48000,
        "discount_percent": 10,
        "discount_amount_cents": 4800,
        "final_amount_cents": 43200,
        "currency": "BRL",
        "status": "pending_payment",
        "valid_from": None,
        "expires_at": None,
        "created_at": NOW,
        "updated_at": NOW,
        "payment_order": _payment_order(),
    }


def test_teacher_package_plan_crud_routes(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(packages_endpoints, "list_my_package_plans_v2", lambda db, user: {"package_plans": [_package_plan()]})
    monkeypatch.setattr(packages_endpoints, "create_my_package_plan_v2", lambda db, user, payload: _package_plan())
    monkeypatch.setattr(
        packages_endpoints,
        "update_my_package_plan_v2",
        lambda db, user, package_plan_id, payload: {**_package_plan(), "name": "Pacote atualizado"},
    )

    list_response = client.get("/api/v2/teachers/me/package-plans")
    create_response = client.post(
        "/api/v2/teachers/me/package-plans",
        json={"code": "PACK4", "name": "Pacote 4 aulas", "sessions_count": 4, "discount_percent": 10},
    )
    patch_response = client.patch(
        "/api/v2/teachers/me/package-plans/33333333-3333-3333-3333-333333333333",
        json={"name": "Pacote atualizado"},
    )

    assert list_response.status_code == 200
    assert create_response.status_code == 201
    assert patch_response.status_code == 200
    assert list_response.json()["package_plans"][0]["code"] == "PACK4"
    assert patch_response.json()["name"] == "Pacote atualizado"


def test_parent_package_purchase_returns_payment_order(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(packages_endpoints, "create_package_purchase_v2", lambda db, user, payload: _booking_package())

    response = client.post(
        "/api/v2/packages/purchases",
        json={
            "package_plan_id": "33333333-3333-3333-3333-333333333333",
            "child_id": "44444444-4444-4444-4444-444444444444",
            "payment_method": "pix",
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "pending_payment"
    assert body["remaining_sessions"] == 4
    assert body["payment_order"]["amount_cents"] == 43200


def test_list_parent_and_teacher_packages(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(packages_endpoints, "list_parent_packages_v2", lambda db, user: {"packages": [_booking_package()]})
    monkeypatch.setattr(packages_endpoints, "list_teacher_packages_v2", lambda db, user: {"packages": [_booking_package()]})

    parent_response = client.get("/api/v2/parents/me/packages")
    teacher_response = client.get("/api/v2/teachers/me/packages")

    assert parent_response.status_code == 200
    assert teacher_response.status_code == 200
    assert parent_response.json()["packages"][0]["total_sessions"] == 4
    assert teacher_response.json()["packages"][0]["final_amount_cents"] == 43200
