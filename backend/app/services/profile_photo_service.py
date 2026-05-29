import importlib
from io import BytesIO
from urllib import error, parse, request
from uuid import uuid4

from PIL import Image, ImageOps, UnidentifiedImageError
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.security import AuthUser
from app.core.ssl_utils import build_ssl_context
from app.schemas.v2_profiles import TeacherProfileUpdateRequest
from app.services.profile_v2_service import update_teacher_profile_v2
from app.services.storage_url_service import resolve_teacher_profile_photo_url

ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
}

PROCESSED_CONTENT_TYPE = "image/jpeg"
PROCESSED_EXTENSION = ".jpg"


class ProfilePhotoUploadError(Exception):
    def __init__(self, detail: str, status_code: int = 422) -> None:
        super().__init__(detail)
        self.detail = detail
        self.status_code = status_code


def _encode_storage_path(path: str) -> str:
    return "/".join(parse.quote(part, safe="") for part in path.split("/") if part)


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


def _normalized_processing_settings(settings: Settings) -> tuple[int, int]:
    target_size = int(settings.profile_photo_target_size_pixels or 512)
    jpeg_quality = int(settings.profile_photo_jpeg_quality or 82)
    return max(64, min(target_size, 2048)), max(50, min(jpeg_quality, 95))


def _to_rgb_image(image: Image.Image) -> Image.Image:
    has_alpha = image.mode in {"RGBA", "LA"} or (image.mode == "P" and "transparency" in image.info)
    if not has_alpha:
        return image.convert("RGB")

    rgba_image = image.convert("RGBA")
    background = Image.new("RGB", rgba_image.size, (255, 255, 255))
    background.paste(rgba_image, mask=rgba_image.getchannel("A"))
    return background


def _process_profile_photo_image(settings: Settings, file_bytes: bytes) -> bytes:
    target_size, jpeg_quality = _normalized_processing_settings(settings)

    try:
        with Image.open(BytesIO(file_bytes)) as image:
            image = ImageOps.exif_transpose(image)
            if image.width <= 0 or image.height <= 0:
                raise ProfilePhotoUploadError("A imagem de perfil é inválida.", status_code=422)

            side = min(image.width, image.height)
            left = (image.width - side) // 2
            top = (image.height - side) // 2
            image = image.crop((left, top, left + side, top + side))

            output_size = min(side, target_size)
            if side > output_size:
                image = image.resize((output_size, output_size), Image.Resampling.LANCZOS)

            image = _to_rgb_image(image)
            output = BytesIO()
            image.save(output, format="JPEG", quality=jpeg_quality, optimize=True, progressive=True)
            return output.getvalue()
    except ProfilePhotoUploadError:
        raise
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise ProfilePhotoUploadError("Não foi possível processar a imagem. Use JPG, PNG ou WEBP.", status_code=422) from exc


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
    ssl_context = build_ssl_context(settings.supabase_jwks_ca_bundle)

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
    ssl_context = build_ssl_context(settings.supabase_jwks_ca_bundle)
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
    processed_file_bytes = _process_profile_photo_image(settings, file_bytes)
    object_key = f"teachers/{user_id}/{uuid4().hex}{PROCESSED_EXTENSION}"
    bucket = settings.profile_photos_bucket

    if settings.storage_s3_access_key_id and settings.storage_s3_secret_access_key:
        try:
            _upload_via_s3(
                settings=settings,
                bucket=bucket,
                object_key=object_key,
                file_bytes=processed_file_bytes,
                content_type=PROCESSED_CONTENT_TYPE,
            )
            return object_key
        except Exception as exc:
            raise ProfilePhotoUploadError(f"Failed to upload profile photo to S3: {exc}", status_code=502) from exc

    _upload_via_supabase_storage_rest(
        settings=settings,
        bucket=bucket,
        object_key=object_key,
        file_bytes=processed_file_bytes,
        content_type=PROCESSED_CONTENT_TYPE,
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
        teacher_profile = update_teacher_profile_v2(
            db,
            user,
            TeacherProfileUpdateRequest(profile_photo_file_name=object_key),
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
        "status": "ok",
        "user_id": teacher_profile["user"]["id"],
        "teacher_id": teacher_profile["id"],
        "role": "teacher",
        "profile_photo_file_name": object_key,
        "profile_photo_url": resolve_teacher_profile_photo_url(settings, object_key),
    }
