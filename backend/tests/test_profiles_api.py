import os
from contextlib import AbstractContextManager
from types import SimpleNamespace
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import SQLAlchemyError

os.environ.setdefault("KIDARIO_SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault(
    "KIDARIO_DATABASE_URL",
    "postgresql+psycopg://postgres:postgres@localhost:5432/postgres",
)

from app.api.deps import get_current_user
from app.api.v2.endpoints import profiles as profiles_endpoints
from app.core.security import AuthUser
from app.db.session import get_db
from app.main import app
from app.services.profile_photo_service import ProfilePhotoUploadError
from app.services.profile_v2_service import ProfileConflictError


NOW = "2026-02-20T10:00:00Z"
USER_ID = UUID("3472def4-1d03-4350-b2c2-20c7fa27d430")
PARENT_ID = UUID("11111111-1111-1111-1111-111111111111")
TEACHER_ID = UUID("22222222-2222-2222-2222-222222222222")
ADDRESS_ID = UUID("33333333-3333-3333-3333-333333333333")
CHILD_ID = UUID("44444444-4444-4444-4444-444444444444")


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
        user_id=str(USER_ID),
        email="hello@luisfernando.io",
        role="authenticated",
    )
    app.dependency_overrides[get_db] = lambda: _DummySession()

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


def _user(role: str) -> dict:
    return {
        "id": USER_ID,
        "email": "hello@luisfernando.io",
        "first_name": "Luis",
        "last_name": "Mendez",
        "role": role,
        "auth_email_confirmed": True,
        "created_at": NOW,
        "updated_at": NOW,
    }


def _address() -> dict:
    return {
        "id": ADDRESS_ID,
        "street": "Rua A",
        "number": "123",
        "complement": None,
        "district": "Centro",
        "city": "Sao Paulo",
        "state": "SP",
        "postal_code": None,
        "country": "BR",
        "latitude": -23.55,
        "longitude": -46.63,
        "created_at": NOW,
        "updated_at": NOW,
    }


def _child() -> dict:
    return {
        "id": CHILD_ID,
        "parent_id": PARENT_ID,
        "name": "Lucas",
        "gender": "boy",
        "birth_month_year": "2017-04-01",
        "current_grade": "3 ano",
        "school": "Colegio A",
        "focus_points": "Leitura",
        "created_at": NOW,
        "updated_at": NOW,
    }


def _parent_profile() -> dict:
    return {
        "id": PARENT_ID,
        "user": _user("parent"),
        "phone": "(11) 99999-9999",
        "birth_date": "1987-10-01",
        "cpf_masked": "***.***.***-01",
        "bio": "Bio teste",
        "address": _address(),
        "children": [_child()],
        "created_at": NOW,
        "updated_at": NOW,
    }


def _teacher_profile() -> dict:
    return {
        "id": TEACHER_ID,
        "user": _user("teacher"),
        "phone": "(11) 98888-9999",
        "cpf_masked": "***.***.***-00",
        "professional_number": "REG123",
        "modality": "online",
        "biography": "Bio teacher",
        "hourly_rate_cents": 12000,
        "lesson_duration_minutes": 60,
        "profile_photo_file_name": "teachers/3472def4/foto.jpg",
        "profile_photo_url": "https://example.com/foto.jpg",
        "hide_experience": False,
        "is_active": True,
        "address": _address(),
        "skills": [
            {
                "id": UUID("55555555-5555-5555-5555-555555555555"),
                "teacher_id": TEACHER_ID,
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


def test_get_me_returns_normalized_identity(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    def _fake_get_me_v2(db, user):
        return {
            "user": _user("parent"),
            "parent_id": PARENT_ID,
            "teacher_id": None,
            "admin": None,
        }

    monkeypatch.setattr(profiles_endpoints, "get_me_v2", _fake_get_me_v2)

    response = client.get("/api/v2/me")

    assert response.status_code == 200
    body = response.json()
    assert body["user"]["email"] == "hello@luisfernando.io"
    assert body["parent_id"] == str(PARENT_ID)
    assert body["teacher_id"] is None


def test_patch_parent_returns_normalized_profile(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(profiles_endpoints, "update_parent_profile_v2", lambda db, user, payload: _parent_profile())

    response = client.patch(
        "/api/v2/parents/me",
        json={
            "first_name": "Luis",
            "last_name": "Mendez",
            "cpf": "12345678901",
            "phone": "(11) 99999-9999",
            "birth_date": "1987-10-01",
            "address": {
                "street": "Rua A",
                "number": "123",
                "district": "Centro",
                "city": "Sao Paulo",
                "state": "SP",
            },
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == str(PARENT_ID)
    assert body["address"]["city"] == "Sao Paulo"
    assert body["children"][0]["name"] == "Lucas"
    assert "cpf" not in body


def test_patch_parent_rejects_client_side_coordinates(client: TestClient) -> None:
    response = client.patch(
        "/api/v2/parents/me",
        json={
            "address": {
                "street": "Rua A",
                "number": "123",
                "district": "Centro",
                "city": "Sao Paulo",
                "state": "SP",
                "latitude": -23.55,
                "longitude": -46.63,
            },
        },
    )

    assert response.status_code == 422


def test_patch_teacher_returns_normalized_profile(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(profiles_endpoints, "update_teacher_profile_v2", lambda db, user, payload: _teacher_profile())

    response = client.patch(
        "/api/v2/teachers/me",
        json={
            "first_name": "Ana",
            "last_name": "Silva",
            "cpf": "12345678900",
            "address": {
                "street": "Rua B",
                "number": "45",
                "district": "Centro",
                "city": "Sao Paulo",
                "state": "SP",
            },
            "availability_ops": {
                "upsert": [{"day_of_week": 0, "start_time": "09:00", "end_time": "10:00"}],
                "delete_ids": [],
            },
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == str(TEACHER_ID)
    assert body["skills"][0]["skill"] == "alfabetizacao"
    assert "cpf" not in body


def test_patch_teacher_role_conflict_returns_409(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def _fake_update_teacher_profile_v2(db, user, payload):
        raise ProfileConflictError("User already registered as role 'parent'.")

    monkeypatch.setattr(profiles_endpoints, "update_teacher_profile_v2", _fake_update_teacher_profile_v2)

    response = client.patch(
        "/api/v2/teachers/me",
        json={
            "first_name": "Ana",
            "address": {"street": "Rua B", "district": "Centro", "city": "Sao Paulo", "state": "SP"},
        },
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "User already registered as role 'parent'."


def test_get_parent_profile_returns_generic_database_error_for_unexpected_sql_error(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    exc = SQLAlchemyError(
        '(psycopg.errors.UndefinedColumn) column "cpf" does not exist\n'
        "LINE 2: select id, phone, cpf, birth_date from parents"
    )
    exc.orig = SimpleNamespace(sqlstate="42703")

    def _fake_get_parent_profile_v2(db, user):
        raise exc

    monkeypatch.setattr(profiles_endpoints, "get_parent_profile_v2", _fake_get_parent_profile_v2)

    response = client.get("/api/v2/parents/me")

    assert response.status_code == 500
    assert response.json()["detail"].startswith("Database error.")


def test_upload_teacher_photo_returns_created(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    def _fake_upload_teacher_profile_photo(db, settings, user, file_name, content_type, file_bytes):
        return {
            "status": "ok",
            "user_id": USER_ID,
            "teacher_id": TEACHER_ID,
            "role": "teacher",
            "profile_photo_file_name": "teachers/3472def4-1d03-4350-b2c2-20c7fa27d430/foto.jpg",
        }

    monkeypatch.setattr(profiles_endpoints, "upload_teacher_profile_photo", _fake_upload_teacher_profile_photo)

    response = client.post(
        "/api/v2/teachers/me/photo",
        files={"file": ("foto.jpg", b"fake-image-content", "image/jpeg")},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["teacher_id"] == str(TEACHER_ID)
    assert body["profile_photo_file_name"].startswith("teachers/3472def4-1d03-4350-b2c2-20c7fa27d430/")


def test_upload_teacher_photo_returns_validation_error(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def _fake_upload_teacher_profile_photo(db, settings, user, file_name, content_type, file_bytes):
        raise ProfilePhotoUploadError("Tipo de arquivo não suportado.", status_code=415)

    monkeypatch.setattr(profiles_endpoints, "upload_teacher_profile_photo", _fake_upload_teacher_profile_photo)

    response = client.post(
        "/api/v2/teachers/me/photo",
        files={"file": ("foto.txt", b"not-image", "text/plain")},
    )

    assert response.status_code == 415
    assert response.json()["detail"] == "Tipo de arquivo não suportado."
