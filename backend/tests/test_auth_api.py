import os
import json
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

from app.api.v2.endpoints import auth as auth_endpoints
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
        assert payload.parent.children[0].birth_month_year.isoformat() == "2017-04-01"
        return {
            "status": "ok",
            "user_id": UUID("b4f13a88-9e68-4d11-bd1b-5d03498ea5f0"),
            "parent_id": UUID("3472def4-1d03-4350-b2c2-20c7fa27d430"),
            "teacher_id": None,
            "role": "parent",
            "email_confirmation_required": False,
            "access_token": "access-token",
            "refresh_token": "refresh-token",
            "expires_in": 3600,
            "token_type": "bearer",
        }

    monkeypatch.setattr(auth_endpoints, "signup_with_profile", _fake_signup_with_profile)
    monkeypatch.setattr(auth_endpoints, "enforce_signup_protection", lambda settings, payload, client_ip: None)

    response = client.post(
        "/api/v2/auth/signup",
        json={
            "email": "parent@example.com",
            "password": "very-secure-password",
            "role": "parent",
            "parent": {
                "first_name": "Maria",
                "last_name": "Silva",
                "cpf": "12345678901",
                "phone": "(11) 99999-9999",
                "birth_date": "1987-10-01",
                "address": {
                    "street": "Rua A",
                    "district": "Centro",
                    "city": "Sao Paulo",
                    "state": "SP",
                },
                "children": [{"name": "Lucas", "birth_month_year": "2017-04"}],
            },
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "ok"
    assert body["role"] == "parent"
    assert body["email_confirmation_required"] is False


def test_post_auth_teacher_signup_uploads_photo_before_response(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def _fake_signup_with_profile(db, settings, payload, teacher_profile_photo=None):
        assert payload.role == "teacher"
        assert payload.teacher is not None
        assert teacher_profile_photo is not None
        assert teacher_profile_photo.file_name == "foto.png"
        assert teacher_profile_photo.content_type == "image/png"
        assert teacher_profile_photo.file_bytes == b"fake-image-content"
        return {
            "status": "ok",
            "user_id": UUID("b4f13a88-9e68-4d11-bd1b-5d03498ea5f0"),
            "parent_id": None,
            "teacher_id": UUID("3472def4-1d03-4350-b2c2-20c7fa27d430"),
            "role": "teacher",
            "email_confirmation_required": True,
            "access_token": None,
            "refresh_token": None,
            "expires_in": None,
            "token_type": None,
        }

    monkeypatch.setattr(auth_endpoints, "signup_with_profile", _fake_signup_with_profile)
    monkeypatch.setattr(auth_endpoints, "enforce_signup_protection", lambda settings, payload, client_ip: None)

    response = client.post(
        "/api/v2/auth/signup/teacher",
        data={
            "payload": json.dumps(
                {
                    "email": "teacher@example.com",
                    "password": "very-secure-password",
                    "role": "teacher",
                    "teacher": {
                        "first_name": "Ana",
                        "last_name": "Silva",
                        "cpf": "12345678900",
                        "address": {
                            "street": "Rua B",
                            "district": "Centro",
                            "city": "Sao Paulo",
                            "state": "SP",
                        },
                    },
                }
            ),
        },
        files={"profile_photo": ("foto.png", b"fake-image-content", "image/png")},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "ok"
    assert body["role"] == "teacher"
    assert body["email_confirmation_required"] is True


def test_post_auth_signup_returns_conflict(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    def _fake_signup_with_profile(db, settings, payload):
        raise AuthSignupError("Este e-mail ja esta cadastrado.", status_code=409)

    monkeypatch.setattr(auth_endpoints, "signup_with_profile", _fake_signup_with_profile)
    monkeypatch.setattr(auth_endpoints, "enforce_signup_protection", lambda settings, payload, client_ip: None)

    response = client.post(
        "/api/v2/auth/signup",
        json={
            "email": "parent@example.com",
            "password": "very-secure-password",
            "role": "parent",
            "parent": {
                "first_name": "Maria",
                "phone": "(11) 99999-9999",
                "cpf": "12345678901",
                "birth_date": "1987-10-01",
                "address": {
                    "street": "Rua A",
                    "district": "Centro",
                    "city": "Sao Paulo",
                    "state": "SP",
                },
                "children": [{"name": "Lucas", "birth_month_year": "2017-04-01"}],
            },
        },
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "Este e-mail ja esta cadastrado."


def test_post_auth_signup_requires_role_specific_payload(client: TestClient) -> None:
    response = client.post(
        "/api/v2/auth/signup",
        json={
            "email": "teacher@example.com",
            "password": "very-secure-password",
            "role": "teacher",
            "parent": {
                "first_name": "Ana",
                "children": [{"name": "Lucas", "birth_month_year": "2017-04-01"}],
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
            "user_id": UUID("b4f13a88-9e68-4d11-bd1b-5d03498ea5f0"),
            "parent_id": UUID("3472def4-1d03-4350-b2c2-20c7fa27d430"),
            "teacher_id": None,
            "role": "parent",
            "email_confirmation_required": False,
            "access_token": "access-token",
            "refresh_token": "refresh-token",
            "expires_in": 3600,
            "token_type": "bearer",
        }

    monkeypatch.setattr(auth_endpoints, "signup_with_profile", _fake_signup_with_profile)

    response = client.post(
        "/api/v2/auth/signup",
        json={
            "email": "parent@example.com",
            "password": "very-secure-password",
            "role": "parent",
            "honeypot": "spam-bot-filled-field",
            "parent": {
                "first_name": "Maria",
                "last_name": "Silva",
                "cpf": "12345678901",
                "phone": "(11) 99999-9999",
                "birth_date": "1987-10-01",
                "address": {
                    "street": "Rua A",
                    "district": "Centro",
                    "city": "Sao Paulo",
                    "state": "SP",
                },
                "children": [{"name": "Lucas", "birth_month_year": "2017-04-01"}],
            },
        },
    )

    assert response.status_code == 400
    assert called is False
