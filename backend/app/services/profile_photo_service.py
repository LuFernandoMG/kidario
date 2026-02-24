import importlib
import mimetypes
import ssl
from urllib import error, parse, request
from uuid import uuid4

import certifi
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.security import AuthUser
from app.schemas.profiles import TeacherProfilePatch
from app.services.profile_service import patch_teacher_profile
from app.services.storage_url_service import resolve_teacher_profile_photo_url

ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
}

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


class ProfilePhotoUploadError(Exception):
    def __init__(self, detail: str, status_code: int = 422) -> None:
        super().__init__(detail)
        self.detail = detail
        self.status_code = status_code


def _encode_storage_path(path: str) -> str:
    return "/".join(parse.quote(part, safe="") for part in path.split("/") if part)


def _resolve_extension(file_name: str | None, content_type: str | None) -> str:
    from_filename = ""
    if file_name:
        dot_index = file_name.rfind(".")
        if dot_index >= 0:
            from_filename = file_name[dot_index:].lower()

    if from_filename in ALLOWED_EXTENSIONS:
        return from_filename

    guessed = mimetypes.guess_extension(content_type or "") if content_type else None
    if guessed in ALLOWED_EXTENSIONS:
        if guessed == ".jpe":
            return ".jpg"
        return guessed

    return ".jpg"


def _validate_upload_input(settings: Settings, file_bytes: bytes, content_type: str | None) -> None:
    if not file_bytes:
        raise ProfilePhotoUploadError("A foto de perfil está vazia.", status_code=422)
    if len(file_bytes) > settings.profile_photo_max_upload_bytes:
        raise ProfilePhotoUploadError(
            f"Arquivo excede o limite de {settings.profile_photo_max_upload_bytes} bytes.",
            status_code=413,
        )
    if content_type and content_type.lower() not in ALLOWED_CONTENT_TYPES:
        raise ProfilePhotoUploadError("Tipo de arquivo não suportado. Use JPG, PNG ou WEBP.", status_code=415)


def _upload_via_supabase_storage_rest(
    *,
    settings: Settings,
    bucket: str,
    object_key: str,
    file_bytes: bytes,
    content_type: str | None,
) -> None:
    if not settings.supabase_service_role_key:
        raise ProfilePhotoUploadError(
            "Storage credentials are not configured. Configure KIDARIO_SUPABASE_SERVICE_ROLE_KEY "
            "or S3 credentials (KIDARIO_STORAGE_S3_ACCESS_KEY_ID/KIDARIO_STORAGE_S3_SECRET_ACCESS_KEY).",
            status_code=503,
        )

    upload_url = (
        f"{settings.supabase_url.rstrip('/')}/storage/v1/object/"
        f"{bucket}/{_encode_storage_path(object_key)}"
    )
    req = request.Request(
        url=upload_url,
        method="POST",
        data=file_bytes,
        headers={
            "apikey": settings.supabase_service_role_key,
            "Authorization": f"Bearer {settings.supabase_service_role_key}",
            "x-upsert": "true",
            "Content-Type": content_type or "application/octet-stream",
        },
    )
    ssl_context = ssl.create_default_context(cafile=settings.supabase_jwks_ca_bundle or certifi.where())

    try:
        with request.urlopen(req, timeout=settings.supabase_http_timeout_seconds, context=ssl_context):
            return
    except error.HTTPError as exc:
        detail = exc.read().decode("utf-8") if exc.fp is not None else str(exc)
        raise ProfilePhotoUploadError(f"Failed to upload profile photo: {detail}", status_code=502) from exc
    except error.URLError as exc:
        raise ProfilePhotoUploadError(f"Could not reach storage: {exc.reason}", status_code=503) from exc


def _delete_via_supabase_storage_rest(*, settings: Settings, bucket: str, object_key: str) -> None:
    if not settings.supabase_service_role_key:
        return

    delete_url = (
        f"{settings.supabase_url.rstrip('/')}/storage/v1/object/"
        f"{bucket}/{_encode_storage_path(object_key)}"
    )
    req = request.Request(
        url=delete_url,
        method="DELETE",
        headers={
            "apikey": settings.supabase_service_role_key,
            "Authorization": f"Bearer {settings.supabase_service_role_key}",
        },
    )
    ssl_context = ssl.create_default_context(cafile=settings.supabase_jwks_ca_bundle or certifi.where())
    try:
        with request.urlopen(req, timeout=settings.supabase_http_timeout_seconds, context=ssl_context):
            return
    except Exception:
        return


def _get_boto3_module():
    return importlib.import_module("boto3")


def _build_s3_client_config():
    botocore_config = importlib.import_module("botocore.config")
    config_class = getattr(botocore_config, "Config")
    return config_class(signature_version="s3v4")


def _upload_via_s3(
    *,
    settings: Settings,
    bucket: str,
    object_key: str,
    file_bytes: bytes,
    content_type: str | None,
) -> None:
    boto3 = _get_boto3_module()
    client_kwargs = {
        "region_name": settings.storage_s3_region,
    }
    if settings.storage_s3_endpoint_url:
        client_kwargs["endpoint_url"] = settings.storage_s3_endpoint_url
    if settings.storage_s3_access_key_id:
        client_kwargs["aws_access_key_id"] = settings.storage_s3_access_key_id
    if settings.storage_s3_secret_access_key:
        client_kwargs["aws_secret_access_key"] = settings.storage_s3_secret_access_key
    client_kwargs["config"] = _build_s3_client_config()

    s3_client = boto3.client("s3", **client_kwargs)
    s3_client.put_object(
        Bucket=bucket,
        Key=object_key,
        Body=file_bytes,
        ContentType=content_type or "application/octet-stream",
        CacheControl="public, max-age=31536000, immutable",
    )


def _delete_via_s3(*, settings: Settings, bucket: str, object_key: str) -> None:
    if not (settings.storage_s3_access_key_id and settings.storage_s3_secret_access_key):
        return
    try:
        boto3 = _get_boto3_module()
        client_kwargs = {
            "region_name": settings.storage_s3_region,
        }
        if settings.storage_s3_endpoint_url:
            client_kwargs["endpoint_url"] = settings.storage_s3_endpoint_url
        client_kwargs["aws_access_key_id"] = settings.storage_s3_access_key_id
        client_kwargs["aws_secret_access_key"] = settings.storage_s3_secret_access_key
        client_kwargs["config"] = _build_s3_client_config()
        s3_client = boto3.client("s3", **client_kwargs)
        s3_client.delete_object(Bucket=bucket, Key=object_key)
    except Exception:
        return


def _upload_photo_blob(
    *,
    settings: Settings,
    user_id: str,
    file_name: str | None,
    content_type: str | None,
    file_bytes: bytes,
) -> str:
    _validate_upload_input(settings, file_bytes, content_type)
    extension = _resolve_extension(file_name, content_type)
    object_key = f"teachers/{user_id}/{uuid4().hex}{extension}"
    bucket = settings.profile_photos_bucket

    if settings.storage_s3_access_key_id and settings.storage_s3_secret_access_key:
        try:
            _upload_via_s3(
                settings=settings,
                bucket=bucket,
                object_key=object_key,
                file_bytes=file_bytes,
                content_type=content_type,
            )
            return object_key
        except Exception as exc:
            raise ProfilePhotoUploadError(f"Failed to upload profile photo to S3: {exc}", status_code=502) from exc

    _upload_via_supabase_storage_rest(
        settings=settings,
        bucket=bucket,
        object_key=object_key,
        file_bytes=file_bytes,
        content_type=content_type,
    )
    return object_key


def upload_teacher_profile_photo(
    db: Session,
    settings: Settings,
    user: AuthUser,
    file_name: str | None,
    content_type: str | None,
    file_bytes: bytes,
) -> dict:
    object_key = _upload_photo_blob(
        settings=settings,
        user_id=user.user_id,
        file_name=file_name,
        content_type=content_type,
        file_bytes=file_bytes,
    )

    try:
        profile_update = patch_teacher_profile(
            db,
            user,
            TeacherProfilePatch(profile_photo_file_name=object_key),
        )
    except Exception as exc:
        _delete_via_s3(settings=settings, bucket=settings.profile_photos_bucket, object_key=object_key)
        _delete_via_supabase_storage_rest(
            settings=settings,
            bucket=settings.profile_photos_bucket,
            object_key=object_key,
        )
        raise ProfilePhotoUploadError(
            "Uploaded photo, but failed to link it to teacher profile. Upload rolled back when possible.",
            status_code=500,
        ) from exc

    return {
        **profile_update,
        "profile_photo_file_name": resolve_teacher_profile_photo_url(settings, object_key) or object_key,
    }
