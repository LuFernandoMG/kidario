import os
from contextlib import AbstractContextManager
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("KIDARIO_SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("KIDARIO_SUPABASE_ANON_KEY", "anon-key")
os.environ.setdefault(
    "KIDARIO_DATABASE_URL",
    "postgresql+psycopg://postgres:postgres@localhost:5432/postgres",
)
# Keep signup protection deterministic in tests regardless of local .env values.
os.environ["KIDARIO_SIGNUP_CAPTCHA_REQUIRED"] = "false"

from app.api.v1.endpoints import auth as auth_endpoints
from app.db.session import get_db
from app.main import app
from app.services.auth_service import AuthSignupError


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
    app.dependency_overrides[get_db] = lambda: _DummySession()
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def test_post_auth_signup_parent_returns_created(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    def _fake_signup_with_profile(db, settings, payload):
        return {
            "status": "ok",
            "profile_id": UUID("3472def4-1d03-4350-b2c2-20c7fa27d430"),
            "auth_user_id": UUID("b4f13a88-9e68-4d11-bd1b-5d03498ea5f0"),
            "role": "parent",
            "email_confirmation_required": False,
            "access_token": "access-token",
            "refresh_token": "refresh-token",
            "expires_in": 3600,
            "token_type": "bearer",
        }

    monkeypatch.setattr(auth_endpoints, "signup_with_profile", _fake_signup_with_profile)

    response = client.post(
        "/api/v1/auth/signup",
        json={
            "email": "parent@example.com",
            "password": "very-secure-password",
            "role": "parent",
            "parent_profile": {
                "first_name": "Maria",
                "last_name": "Silva",
                "cpf": "12345678901",
                "children_ops": {
                    "upsert": [{"name": "Lucas", "birth_month_year": "2017-04"}],
                    "delete_ids": [],
                },
            },
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "ok"
    assert body["role"] == "parent"
    assert body["email_confirmation_required"] is False


def test_post_auth_signup_returns_conflict(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    def _fake_signup_with_profile(db, settings, payload):
        raise AuthSignupError("Este e-mail ja esta cadastrado.", status_code=409)

    monkeypatch.setattr(auth_endpoints, "signup_with_profile", _fake_signup_with_profile)

    response = client.post(
        "/api/v1/auth/signup",
        json={
            "email": "parent@example.com",
            "password": "very-secure-password",
            "role": "parent",
            "parent_profile": {
                "first_name": "Maria",
                "children_ops": {
                    "upsert": [{"name": "Lucas", "birth_month_year": "2017-04"}],
                    "delete_ids": [],
                },
            },
        },
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "Este e-mail ja esta cadastrado."


def test_post_auth_signup_requires_role_specific_payload(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/signup",
        json={
            "email": "teacher@example.com",
            "password": "very-secure-password",
            "role": "teacher",
            "parent_profile": {
                "first_name": "Ana",
                "children_ops": {
                    "upsert": [{"name": "Lucas", "birth_month_year": "2017-04"}],
                    "delete_ids": [],
                },
            },
        },
    )

    assert response.status_code == 422


def test_post_auth_signup_rejects_honeypot(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    called = False

    def _fake_signup_with_profile(db, settings, payload):
        nonlocal called
        called = True
        return {
            "status": "ok",
            "profile_id": UUID("3472def4-1d03-4350-b2c2-20c7fa27d430"),
            "auth_user_id": UUID("b4f13a88-9e68-4d11-bd1b-5d03498ea5f0"),
            "role": "parent",
            "email_confirmation_required": False,
            "access_token": "access-token",
            "refresh_token": "refresh-token",
            "expires_in": 3600,
            "token_type": "bearer",
        }

    monkeypatch.setattr(auth_endpoints, "signup_with_profile", _fake_signup_with_profile)

    response = client.post(
        "/api/v1/auth/signup",
        json={
            "email": "parent@example.com",
            "password": "very-secure-password",
            "role": "parent",
            "honeypot": "spam-bot-filled-field",
            "parent_profile": {
                "first_name": "Maria",
                "last_name": "Silva",
                "cpf": "12345678901",
                "children_ops": {
                    "upsert": [{"name": "Lucas", "birth_month_year": "2017-04"}],
                    "delete_ids": [],
                },
            },
        },
    )

    assert response.status_code == 400
    assert called is False
