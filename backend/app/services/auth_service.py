import json
import ssl
from typing import Any
from urllib import error, request
from uuid import UUID

import certifi
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.security import AuthUser
from app.schemas.auth import AuthSignupRequest
from app.services.profile_service import (
    ProfileConflictError,
    ProfileValidationError,
    patch_parent_profile,
    patch_teacher_profile,
)


class AuthSignupError(Exception):
    def __init__(self, detail: str, status_code: int = 400) -> None:
        super().__init__(detail)
        self.detail = detail
        self.status_code = status_code


def _http_json_request(
    *,
    url: str,
    method: str,
    headers: dict[str, str],
    body: dict[str, Any] | None,
    timeout_seconds: float,
    ca_bundle_path: str | None = None,
) -> tuple[int, dict[str, Any]]:
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = request.Request(url=url, data=data, method=method, headers=headers)
    ssl_context = ssl.create_default_context(cafile=ca_bundle_path or certifi.where())

    try:
        with request.urlopen(req, timeout=timeout_seconds, context=ssl_context) as response:
            payload_raw = response.read().decode("utf-8")
            payload = json.loads(payload_raw) if payload_raw else {}
            return int(response.status), payload
    except error.HTTPError as exc:
        payload_raw = exc.read().decode("utf-8") if exc.fp is not None else ""
        payload = json.loads(payload_raw) if payload_raw else {}
        return int(exc.code), payload
    except error.URLError as exc:
        raise AuthSignupError(f"Could not reach Supabase Auth: {exc.reason}", status_code=503) from exc


def _extract_auth_error(payload: dict[str, Any], fallback: str) -> str:
    for key in ("msg", "error_description", "error", "message"):
        value = payload.get(key)
        if isinstance(value, str) and value.strip():
            return value
    return fallback


def _build_signup_metadata(payload: AuthSignupRequest) -> dict[str, Any]:
    metadata = dict(payload.metadata or {})
    metadata["role"] = payload.role
    if payload.full_name:
        metadata.setdefault("full_name", payload.full_name)

    if payload.role == "parent" and payload.parent_profile:
        metadata.setdefault("first_name", payload.parent_profile.first_name)
        metadata.setdefault("last_name", payload.parent_profile.last_name)
    if payload.role == "teacher" and payload.teacher_profile:
        metadata.setdefault("first_name", payload.teacher_profile.first_name)
        metadata.setdefault("last_name", payload.teacher_profile.last_name)

    return metadata


def _extract_signup_user_payload(signup_payload: dict[str, Any]) -> dict[str, Any]:
    """
    Supabase /auth/v1/signup may return:
    - Access token schema with nested `user`
    - User schema directly at top-level (contains `id`)
    """
    nested_user = signup_payload.get("user")
    if isinstance(nested_user, dict):
        return nested_user
    if signup_payload.get("id") is not None:
        return signup_payload
    return {}


def _extract_signup_session_payload(signup_payload: dict[str, Any]) -> dict[str, Any]:
    nested_session = signup_payload.get("session")
    if isinstance(nested_session, dict):
        return nested_session

    # Some GoTrue responses include token fields at top-level.
    token_fields = ("access_token", "refresh_token", "expires_in", "token_type")
    if any(signup_payload.get(field) is not None for field in token_fields):
        return {
            "access_token": signup_payload.get("access_token"),
            "refresh_token": signup_payload.get("refresh_token"),
            "expires_in": signup_payload.get("expires_in"),
            "token_type": signup_payload.get("token_type"),
        }
    return {}


def _try_delete_auth_user(settings: Settings, auth_user_id: str) -> tuple[bool, str | None]:
    if not settings.supabase_service_role_key:
        return False, "service role key is not configured"

    url = f"{settings.supabase_url.rstrip('/')}/auth/v1/admin/users/{auth_user_id}"
    status_code, payload = _http_json_request(
        url=url,
        method="DELETE",
        headers={
            "apikey": settings.supabase_service_role_key,
            "Authorization": f"Bearer {settings.supabase_service_role_key}",
            "Content-Type": "application/json",
        },
        body=None,
        timeout_seconds=settings.supabase_http_timeout_seconds,
        ca_bundle_path=settings.supabase_jwks_ca_bundle,
    )
    if 200 <= status_code < 300:
        return True, None

    detail = _extract_auth_error(payload, "Failed to delete auth user during compensation.")
    return False, detail


def signup_with_profile(db: Session, settings: Settings, payload: AuthSignupRequest) -> dict[str, Any]:
    if not settings.supabase_anon_key:
        raise AuthSignupError(
            "Supabase anon key is not configured (KIDARIO_SUPABASE_ANON_KEY).",
            status_code=503,
        )

    signup_url = f"{settings.supabase_url.rstrip('/')}/auth/v1/signup"
    signup_status, signup_payload = _http_json_request(
        url=signup_url,
        method="POST",
        headers={
            "apikey": settings.supabase_anon_key,
            "Content-Type": "application/json",
        },
        body={
            "email": payload.email,
            "password": payload.password,
            "data": _build_signup_metadata(payload),
        },
        timeout_seconds=settings.supabase_http_timeout_seconds,
        ca_bundle_path=settings.supabase_jwks_ca_bundle,
    )

    if signup_status < 200 or signup_status >= 300:
        detail = _extract_auth_error(signup_payload, "Failed to create user in Supabase Auth.")
        conflict = "already" in detail.lower() or "registered" in detail.lower()
        raise AuthSignupError(detail, status_code=409 if conflict else 422)

    user = _extract_signup_user_payload(signup_payload)
    auth_user_id = str(user.get("id") or "").strip()
    if not auth_user_id:
        raise AuthSignupError(
            f"Supabase Auth response did not include user id (response keys: {sorted(signup_payload.keys())}).",
            status_code=502,
        )

    identities = user.get("identities")
    session = _extract_signup_session_payload(signup_payload)
    has_session = bool(session.get("access_token") and session.get("refresh_token"))
    if isinstance(identities, list) and len(identities) == 0 and not has_session:
        raise AuthSignupError("Este e-mail ja esta cadastrado.", status_code=409)

    auth_user = AuthUser(user_id=auth_user_id, email=payload.email, role="authenticated")

    try:
        with db.begin():
            if payload.role == "parent":
                if payload.parent_profile is None:
                    raise AuthSignupError("parent_profile is required when role is 'parent'.", status_code=422)
                profile_data = patch_parent_profile(db, auth_user, payload.parent_profile)
            else:
                if payload.teacher_profile is None:
                    raise AuthSignupError("teacher_profile is required when role is 'teacher'.", status_code=422)
                profile_data = patch_teacher_profile(db, auth_user, payload.teacher_profile)
    except ProfileConflictError as exc:
        deleted, reason = _try_delete_auth_user(settings, auth_user_id)
        suffix = "" if deleted else f" Compensation pending ({reason})."
        raise AuthSignupError(f"{exc}{suffix}", status_code=409) from exc
    except ProfileValidationError as exc:
        deleted, reason = _try_delete_auth_user(settings, auth_user_id)
        suffix = "" if deleted else f" Compensation pending ({reason})."
        raise AuthSignupError(f"{exc}{suffix}", status_code=422) from exc
    except AuthSignupError:
        raise
    except Exception as exc:
        deleted, reason = _try_delete_auth_user(settings, auth_user_id)
        suffix = "" if deleted else f" Compensation pending ({reason})."
        raise AuthSignupError(
            f"Could not persist profile after auth signup.{suffix}",
            status_code=500,
        ) from exc

    return {
        "status": "ok",
        "profile_id": UUID(str(profile_data["profile_id"])),
        "auth_user_id": UUID(auth_user_id),
        "role": payload.role,
        "email_confirmation_required": not has_session,
        "access_token": session.get("access_token"),
        "refresh_token": session.get("refresh_token"),
        "expires_in": session.get("expires_in"),
        "token_type": session.get("token_type"),
    }
