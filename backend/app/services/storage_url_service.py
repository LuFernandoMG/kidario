import importlib
import json
import ssl
from urllib import error, parse, request

import certifi

from app.core.config import Settings


def _get_boto3_module():
    return importlib.import_module("boto3")


def _build_s3_client_config():
    botocore_config = importlib.import_module("botocore.config")
    config_class = getattr(botocore_config, "Config")
    return config_class(signature_version="s3v4")


def _encode_storage_path(path: str) -> str:
    return "/".join(parse.quote(part, safe="") for part in path.split("/") if part)


def _normalize_object_key(raw_path: str, bucket: str) -> str:
    normalized = raw_path.strip().lstrip("/")
    if not normalized:
        return ""
    if normalized.startswith(f"{bucket}/"):
        return normalized[len(bucket) + 1 :]
    return normalized


def _build_public_storage_url(settings: Settings, object_key: str) -> str:
    return (
        f"{settings.supabase_url.rstrip('/')}/storage/v1/object/public/"
        f"{settings.profile_photos_bucket}/{_encode_storage_path(object_key)}"
    )


def _build_absolute_supabase_signed_url(settings: Settings, signed_url_path: str) -> str | None:
    if not signed_url_path:
        return None
    normalized = signed_url_path.strip()
    if normalized.startswith("http://") or normalized.startswith("https://"):
        return normalized
    if normalized.startswith("/storage/v1/"):
        return f"{settings.supabase_url.rstrip('/')}{normalized}"
    if normalized.startswith("storage/v1/"):
        return f"{settings.supabase_url.rstrip('/')}/{normalized}"
    if normalized.startswith("/object/"):
        return f"{settings.supabase_url.rstrip('/')}/storage/v1{normalized}"
    if normalized.startswith("object/"):
        return f"{settings.supabase_url.rstrip('/')}/storage/v1/{normalized}"
    return None


def _append_token_if_missing(url: str, token: str | None) -> str:
    if not token:
        return url
    if "token=" in url:
        return url
    separator = "&" if "?" in url else "?"
    return f"{url}{separator}token={parse.quote(token, safe='')}"


def _extract_signed_url_and_token(payload: dict) -> tuple[str | None, str | None]:
    signed_value = payload.get("signedURL") or payload.get("signedUrl")
    if isinstance(signed_value, str) and signed_value.strip():
        return signed_value, payload.get("token") if isinstance(payload.get("token"), str) else None

    data = payload.get("data")
    if isinstance(data, dict):
        nested_signed_value = data.get("signedURL") or data.get("signedUrl")
        nested_token = data.get("token")
        return (
            nested_signed_value if isinstance(nested_signed_value, str) else None,
            nested_token if isinstance(nested_token, str) else None,
        )
    return None, None


def _create_supabase_signed_url(settings: Settings, object_key: str) -> str | None:
    if not settings.supabase_service_role_key:
        return None

    sign_url = (
        f"{settings.supabase_url.rstrip('/')}/storage/v1/object/sign/"
        f"{settings.profile_photos_bucket}/{_encode_storage_path(object_key)}"
    )
    req = request.Request(
        url=sign_url,
        method="POST",
        data=json.dumps({"expiresIn": settings.profile_photo_signed_url_ttl_seconds}).encode("utf-8"),
        headers={
            "apikey": settings.supabase_service_role_key,
            "Authorization": f"Bearer {settings.supabase_service_role_key}",
            "Content-Type": "application/json",
        },
    )
    ssl_context = ssl.create_default_context(cafile=settings.supabase_jwks_ca_bundle or certifi.where())

    try:
        with request.urlopen(req, timeout=settings.supabase_http_timeout_seconds, context=ssl_context) as response:
            payload_raw = response.read().decode("utf-8")
            payload = json.loads(payload_raw) if payload_raw else {}
            signed_value, token = _extract_signed_url_and_token(payload)
            if isinstance(signed_value, str):
                absolute_url = _build_absolute_supabase_signed_url(settings, signed_value)
                if absolute_url:
                    return _append_token_if_missing(absolute_url, token)
            if token:
                base_url = (
                    f"{settings.supabase_url.rstrip('/')}/storage/v1/object/sign/"
                    f"{settings.profile_photos_bucket}/{_encode_storage_path(object_key)}"
                )
                return _append_token_if_missing(base_url, token)
            return None
    except (error.HTTPError, error.URLError, json.JSONDecodeError):
        return None


def _create_s3_presigned_url(settings: Settings, object_key: str) -> str | None:
    if not (settings.storage_s3_access_key_id and settings.storage_s3_secret_access_key):
        return None
    try:
        boto3 = _get_boto3_module()
        client_kwargs = {
            "region_name": settings.storage_s3_region,
            "aws_access_key_id": settings.storage_s3_access_key_id,
            "aws_secret_access_key": settings.storage_s3_secret_access_key,
        }
        if settings.storage_s3_endpoint_url:
            client_kwargs["endpoint_url"] = settings.storage_s3_endpoint_url
        client_kwargs["config"] = _build_s3_client_config()
        s3_client = boto3.client("s3", **client_kwargs)
        return s3_client.generate_presigned_url(
            ClientMethod="get_object",
            Params={"Bucket": settings.profile_photos_bucket, "Key": object_key},
            ExpiresIn=settings.profile_photo_signed_url_ttl_seconds,
        )
    except Exception:
        return None


def resolve_teacher_profile_photo_url(settings: Settings, raw_path: str | None) -> str | None:
    if not raw_path:
        return None
    value = raw_path.strip()
    if not value:
        return None
    if value.startswith("http://") or value.startswith("https://") or value.startswith("data:image/"):
        return value

    object_key = _normalize_object_key(value, settings.profile_photos_bucket)
    if not object_key:
        return None

    s3_signed_url = _create_s3_presigned_url(settings, object_key)
    if s3_signed_url:
        return s3_signed_url

    supabase_signed_url = _create_supabase_signed_url(settings, object_key)
    if supabase_signed_url:
        return supabase_signed_url

    return _build_public_storage_url(settings, object_key)
