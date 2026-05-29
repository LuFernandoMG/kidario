from io import BytesIO
from types import SimpleNamespace

import pytest
from PIL import Image

from app.services import profile_photo_service
from app.services.profile_photo_service import (
    ProfilePhotoUploadError,
    _process_profile_photo_image,
    _upload_photo_blob,
)


def _settings(**overrides) -> SimpleNamespace:
    values = {
        "profile_photo_max_upload_bytes": 5_242_880,
        "profile_photo_target_size_pixels": 512,
        "profile_photo_jpeg_quality": 82,
        "profile_photos_bucket": "teacher-profile-photos",
        "storage_s3_access_key_id": None,
        "storage_s3_secret_access_key": None,
        "supabase_service_role_key": "service-role",
        "supabase_url": "https://example.supabase.co",
        "supabase_jwks_ca_bundle": None,
        "supabase_http_timeout_seconds": 15.0,
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def _image_bytes(size: tuple[int, int], *, image_format: str = "PNG", mode: str = "RGB") -> bytes:
    image = Image.new(mode, size, (40, 120, 220))
    output = BytesIO()
    image.save(output, format=image_format)
    return output.getvalue()


def _open_image(file_bytes: bytes) -> Image.Image:
    return Image.open(BytesIO(file_bytes))


def test_process_profile_photo_center_crops_and_resizes_to_jpeg() -> None:
    processed = _process_profile_photo_image(_settings(), _image_bytes((1200, 800)))

    with _open_image(processed) as image:
        assert image.format == "JPEG"
        assert image.mode == "RGB"
        assert image.size == (512, 512)


def test_process_profile_photo_does_not_upscale_small_images() -> None:
    processed = _process_profile_photo_image(_settings(), _image_bytes((128, 128), image_format="WEBP"))

    with _open_image(processed) as image:
        assert image.format == "JPEG"
        assert image.size == (128, 128)


def test_process_profile_photo_rejects_invalid_image_bytes() -> None:
    with pytest.raises(ProfilePhotoUploadError) as exc_info:
        _process_profile_photo_image(_settings(), b"not-an-image")

    assert exc_info.value.status_code == 422


def test_upload_photo_blob_sends_processed_jpeg_to_storage(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, object] = {}

    def _fake_upload_via_supabase_storage_rest(**kwargs) -> None:
        captured.update(kwargs)

    monkeypatch.setattr(
        profile_photo_service,
        "_upload_via_supabase_storage_rest",
        _fake_upload_via_supabase_storage_rest,
    )

    object_key = _upload_photo_blob(
        settings=_settings(),
        user_id="user-123",
        file_name="original.png",
        content_type="image/png",
        file_bytes=_image_bytes((1600, 900)),
    )

    assert object_key.startswith("teachers/user-123/")
    assert object_key.endswith(".jpg")
    assert captured["bucket"] == "teacher-profile-photos"
    assert captured["object_key"] == object_key
    assert captured["content_type"] == "image/jpeg"

    with _open_image(captured["file_bytes"]) as image:
        assert image.format == "JPEG"
        assert image.size == (512, 512)
