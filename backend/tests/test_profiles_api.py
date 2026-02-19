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
from app.api.v1.endpoints import profiles as profiles_endpoints
from app.core.security import AuthUser
from app.db.session import get_db
from app.main import app
from app.services.profile_service import ProfileConflictError


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


def test_profiles_me_returns_profile(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    def _fake_get_me(db, user):
        return {
            "profile": {
                "id": UUID("3472def4-1d03-4350-b2c2-20c7fa27d430"),
                "email": "hello@luisfernando.io",
                "first_name": "Luis",
                "last_name": "Mendez",
                "role": "parent",
            },
            "parent_profile_exists": True,
            "teacher_profile_exists": False,
        }

    monkeypatch.setattr(profiles_endpoints, "get_me", _fake_get_me)

    response = client.get("/api/v1/profiles/me")

    assert response.status_code == 200
    body = response.json()
    assert body["profile"]["email"] == "hello@luisfernando.io"
    assert body["profile"]["role"] == "parent"
    assert body["parent_profile_exists"] is True
    assert body["teacher_profile_exists"] is False


def test_patch_parent_returns_ok(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    def _fake_patch_parent_profile(db, user, payload):
        return {
            "status": "ok",
            "profile_id": UUID("3472def4-1d03-4350-b2c2-20c7fa27d430"),
            "role": "parent",
        }

    monkeypatch.setattr(profiles_endpoints, "patch_parent_profile", _fake_patch_parent_profile)

    response = client.patch(
        "/api/v1/profiles/parent",
        json={
            "first_name": "Luis",
            "last_name": "Mendez",
            "children_ops": {
                "upsert": [
                    {
                        "name": "Lucas",
                        "birth_month_year": "2017-04",
                    }
                ],
                "delete_ids": [],
            },
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["role"] == "parent"
    assert body["profile_id"] == "3472def4-1d03-4350-b2c2-20c7fa27d430"


def test_patch_teacher_returns_ok(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    def _fake_patch_teacher_profile(db, user, payload):
        return {
            "status": "ok",
            "profile_id": UUID("3472def4-1d03-4350-b2c2-20c7fa27d430"),
            "role": "teacher",
        }

    monkeypatch.setattr(profiles_endpoints, "patch_teacher_profile", _fake_patch_teacher_profile)

    response = client.patch(
        "/api/v1/profiles/teacher",
        json={
            "first_name": "Ana",
            "last_name": "Silva",
            "availability_ops": {
                "upsert": [
                    {
                        "day_of_week": 0,
                        "start_time": "09:00",
                        "end_time": "10:00",
                    }
                ],
                "delete_ids": [],
            },
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["role"] == "teacher"
    assert body["profile_id"] == "3472def4-1d03-4350-b2c2-20c7fa27d430"


def test_patch_teacher_role_conflict_returns_409(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def _fake_patch_teacher_profile(db, user, payload):
        raise ProfileConflictError("User already registered as role 'parent'.")

    monkeypatch.setattr(profiles_endpoints, "patch_teacher_profile", _fake_patch_teacher_profile)

    response = client.patch(
        "/api/v1/profiles/teacher",
        json={
            "first_name": "Ana",
            "availability_ops": {
                "upsert": [
                    {
                        "day_of_week": 1,
                        "start_time": "10:00",
                        "end_time": "11:00",
                    }
                ],
                "delete_ids": [],
            },
        },
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "User already registered as role 'parent'."
