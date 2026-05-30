from types import SimpleNamespace

import pytest

from app.services import auth_service


def test_extract_signup_user_payload_from_nested_user() -> None:
    payload = {
        "user": {"id": "3f03f5fc-d2c2-4f79-ac10-53dbd2258f41", "identities": [{"id": "a"}]},
        "session": {"access_token": "at", "refresh_token": "rt"},
    }

    user = auth_service._extract_signup_user_payload(payload)

    assert user["id"] == "3f03f5fc-d2c2-4f79-ac10-53dbd2258f41"


def test_extract_signup_user_payload_from_top_level_user_schema() -> None:
    payload = {
        "id": "3f03f5fc-d2c2-4f79-ac10-53dbd2258f41",
        "email": "parent@example.com",
        "identities": [{"id": "a"}],
    }

    user = auth_service._extract_signup_user_payload(payload)

    assert user["id"] == "3f03f5fc-d2c2-4f79-ac10-53dbd2258f41"


def test_extract_signup_session_payload_from_top_level_token_fields() -> None:
    payload = {
        "access_token": "at",
        "refresh_token": "rt",
        "expires_in": 3600,
        "token_type": "bearer",
    }

    session = auth_service._extract_signup_session_payload(payload)

    assert session == payload


def test_verify_supabase_password_accepts_current_user(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, object] = {}

    def _fake_http_json_request(**kwargs):
        captured.update(kwargs)
        return 200, {"user": {"id": "user-1"}}

    monkeypatch.setattr(auth_service, "_http_json_request", _fake_http_json_request)

    auth_service.verify_supabase_password(
        SimpleNamespace(
            supabase_url="https://example.supabase.co",
            supabase_anon_key="anon",
            supabase_http_timeout_seconds=15,
            supabase_jwks_ca_bundle=None,
        ),
        email="ana@example.com",
        password="secret-pass",
        expected_user_id="user-1",
    )

    assert captured["url"] == "https://example.supabase.co/auth/v1/token?grant_type=password"
    assert captured["body"] == {"email": "ana@example.com", "password": "secret-pass"}


def test_verify_supabase_password_rejects_wrong_password(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        auth_service,
        "_http_json_request",
        lambda **kwargs: (400, {"error": "invalid_credentials"}),
    )

    with pytest.raises(auth_service.AuthPasswordVerificationError, match="Senha incorreta"):
        auth_service.verify_supabase_password(
            SimpleNamespace(
                supabase_url="https://example.supabase.co",
                supabase_anon_key="anon",
                supabase_http_timeout_seconds=15,
                supabase_jwks_ca_bundle=None,
            ),
            email="ana@example.com",
            password="wrong-pass",
            expected_user_id="user-1",
        )
