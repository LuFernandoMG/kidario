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
from app.api.v2.endpoints import profiles as profiles_v2_endpoints
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
    app.dependency_overrides[get_current_user] = lambda: AuthUser(
        user_id="3472def4-1d03-4350-b2c2-20c7fa27d430",
        email="hello@kidario.com",
        role="authenticated",
    )
    app.dependency_overrides[get_db] = lambda: _DummySession()

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


def _user(role: str = "parent") -> dict:
    return {
        "id": UUID("3472def4-1d03-4350-b2c2-20c7fa27d430"),
        "email": "hello@kidario.com",
        "first_name": "Maria",
        "last_name": "Silva",
        "role": role,
        "auth_email_confirmed": True,
        "created_at": NOW,
        "updated_at": NOW,
    }


def _address() -> dict:
    return {
        "id": UUID("22222222-2222-2222-2222-222222222222"),
        "street": "Rua A",
        "number": "123",
        "complement": None,
        "district": "Centro",
        "city": "Sao Paulo",
        "state": "SP",
        "postal_code": "01000-000",
        "country": "BR",
        "latitude": -23.55,
        "longitude": -46.63,
        "created_at": NOW,
        "updated_at": NOW,
    }


def _child() -> dict:
    return {
        "id": UUID("33333333-3333-3333-3333-333333333333"),
        "parent_id": UUID("11111111-1111-1111-1111-111111111111"),
        "name": "Lucas",
        "gender": "boy",
        "birth_month_year": "2017-04-01",
        "current_grade": "3 ano",
        "school": "Colegio A",
        "focus_points": "Leitura",
        "created_at": NOW,
        "updated_at": NOW,
    }


def test_get_v2_me_supports_admin_identity(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    def _fake_get_me_v2(db, user):
        return {
            "user": _user(role="admin"),
            "parent_id": None,
            "teacher_id": None,
            "admin": {"is_admin": True},
        }

    monkeypatch.setattr(profiles_v2_endpoints, "get_me_v2", _fake_get_me_v2)

    response = client.get("/api/v2/me")

    assert response.status_code == 200
    body = response.json()
    assert body["user"]["role"] == "admin"
    assert body["admin"]["is_admin"] is True
    assert body["parent_id"] is None
    assert body["teacher_id"] is None


def test_get_v2_parent_profile_returns_address_and_masks_cpf(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def _fake_get_parent_profile_v2(db, user):
        return {
            "id": UUID("11111111-1111-1111-1111-111111111111"),
            "user": _user(role="parent"),
            "phone": "(11) 99999-9999",
            "birth_date": "1987-10-01",
            "cpf": "12345678901",
            "cpf_masked": "***.***.***-01",
            "bio": "Bio teste",
            "address": _address(),
            "children": [_child()],
            "created_at": NOW,
            "updated_at": NOW,
        }

    monkeypatch.setattr(profiles_v2_endpoints, "get_parent_profile_v2", _fake_get_parent_profile_v2)

    response = client.get("/api/v2/parents/me")

    assert response.status_code == 200
    body = response.json()
    assert body["cpf_masked"] == "***.***.***-01"
    assert "cpf" not in body
    assert body["address"]["latitude"] == -23.55
    assert body["children"][0]["name"] == "Lucas"


def test_get_v2_teacher_profile_returns_address_and_masks_cpf(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def _fake_get_teacher_profile_v2(db, user):
        return {
            "id": UUID("44444444-4444-4444-4444-444444444444"),
            "user": _user(role="teacher"),
            "phone": "(11) 98888-9999",
            "cpf": "12345678900",
            "cpf_masked": "***.***.***-00",
            "professional_number": "REG123",
            "modality": "ambos",
            "biography": "Bio teacher",
            "hourly_rate_cents": 12000,
            "lesson_duration_minutes": 60,
            "profile_photo_file_name": "teachers/ana/foto.jpg",
            "profile_photo_url": "https://cdn.example/foto.jpg",
            "hide_experience": False,
            "is_active": True,
            "address": _address(),
            "skills": [
                {
                    "id": UUID("55555555-5555-5555-5555-555555555555"),
                    "teacher_id": UUID("44444444-4444-4444-4444-444444444444"),
                    "skill": "alfabetizacao",
                    "created_at": NOW,
                    "updated_at": NOW,
                }
            ],
            "academic_records": [],
            "experiences": [],
            "availability": [],
            "created_at": NOW,
            "updated_at": NOW,
        }

    monkeypatch.setattr(profiles_v2_endpoints, "get_teacher_profile_v2", _fake_get_teacher_profile_v2)

    response = client.get("/api/v2/teachers/me")

    assert response.status_code == 200
    body = response.json()
    assert body["cpf_masked"] == "***.***.***-00"
    assert "cpf" not in body
    assert body["address"]["city"] == "Sao Paulo"
    assert body["skills"][0]["skill"] == "alfabetizacao"


def test_v2_children_crud_routes(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(profiles_v2_endpoints, "list_my_children_v2", lambda db, user: {"children": [_child()]})
    monkeypatch.setattr(profiles_v2_endpoints, "create_child_v2", lambda db, user, payload: _child())
    monkeypatch.setattr(profiles_v2_endpoints, "update_child_v2", lambda db, user, child_id, payload: _child())
    monkeypatch.setattr(
        profiles_v2_endpoints,
        "delete_child_v2",
        lambda db, user, child_id: {"status": "ok", "child_id": child_id},
    )

    list_response = client.get("/api/v2/parents/me/children")
    create_response = client.post("/api/v2/parents/me/children", json={"name": "Lucas"})
    patch_response = client.patch(
        "/api/v2/parents/me/children/33333333-3333-3333-3333-333333333333",
        json={"current_grade": "4 ano"},
    )
    delete_response = client.delete("/api/v2/parents/me/children/33333333-3333-3333-3333-333333333333")

    assert list_response.status_code == 200
    assert create_response.status_code == 201
    assert patch_response.status_code == 200
    assert delete_response.status_code == 200
    assert list_response.json()["children"][0]["name"] == "Lucas"
    assert delete_response.json()["child_id"] == "33333333-3333-3333-3333-333333333333"
