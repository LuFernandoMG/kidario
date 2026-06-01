from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest

from app.core import security
from app.core.security import InvalidTokenError, SupabaseJWTVerifier

JWT_SECRET = "test-secret-with-at-least-thirty-two-bytes"
JWT_ISSUER = "https://example.supabase.co/auth/v1"
JWT_AUDIENCE = "authenticated"


def _patch_settings(monkeypatch: pytest.MonkeyPatch, *, leeway_seconds: int) -> None:
    monkeypatch.setattr(
        security,
        "get_settings",
        lambda: SimpleNamespace(
            supabase_jwt_audience=JWT_AUDIENCE,
            jwt_issuer=JWT_ISSUER,
            supabase_jwt_secret=JWT_SECRET,
            supabase_jwt_leeway_seconds=leeway_seconds,
            jwt_jwks_url=f"{JWT_ISSUER}/.well-known/jwks.json",
            supabase_jwks_ca_bundle=None,
        ),
    )


def _make_token(*, iat_offset_seconds: int) -> str:
    jwt_module = security._get_pyjwt_module()
    now = datetime.now(timezone.utc)
    issued_at = now + timedelta(seconds=iat_offset_seconds)
    payload = {
        "sub": "teacher-user-id",
        "email": "teacher@example.com",
        "role": "authenticated",
        "aud": JWT_AUDIENCE,
        "iss": JWT_ISSUER,
        "iat": issued_at,
        "exp": now + timedelta(hours=1),
    }
    return jwt_module.encode(payload, JWT_SECRET, algorithm="HS256")


def test_supabase_jwt_verifier_accepts_iat_within_configured_leeway(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _patch_settings(monkeypatch, leeway_seconds=60)

    user = SupabaseJWTVerifier().verify(_make_token(iat_offset_seconds=30))

    assert user.user_id == "teacher-user-id"
    assert user.email == "teacher@example.com"
    assert user.role == "authenticated"


def test_supabase_jwt_verifier_rejects_iat_beyond_configured_leeway(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _patch_settings(monkeypatch, leeway_seconds=30)

    with pytest.raises(InvalidTokenError, match="not yet valid"):
        SupabaseJWTVerifier().verify(_make_token(iat_offset_seconds=90))
