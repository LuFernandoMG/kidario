from types import SimpleNamespace

from app.services import storage_url_service
from app.services.storage_url_service import resolve_teacher_profile_photo_url


def _settings() -> SimpleNamespace:
    return SimpleNamespace(
        profile_photos_bucket="teacher-profile-photos",
        supabase_url="https://example.supabase.co",
    )


def test_resolve_teacher_profile_photo_url_re_signs_supabase_signed_url(monkeypatch) -> None:
    captured: dict[str, str] = {}

    def _fake_signed_url(settings, object_key):
        captured["object_key"] = object_key
        return f"https://cdn.example/{object_key}"

    monkeypatch.setattr(storage_url_service, "_create_s3_presigned_url", lambda settings, object_key: None)
    monkeypatch.setattr(storage_url_service, "_create_supabase_signed_url", _fake_signed_url)

    url = resolve_teacher_profile_photo_url(
        _settings(),
        "https://example.supabase.co/storage/v1/object/sign/teacher-profile-photos/"
        "WhatsApp%20Image%202025-08-01%20at%2018.25.39.jpeg?token=expired",
    )

    assert captured["object_key"] == "WhatsApp Image 2025-08-01 at 18.25.39.jpeg"
    assert url == "https://cdn.example/WhatsApp Image 2025-08-01 at 18.25.39.jpeg"


def test_resolve_teacher_profile_photo_url_re_signs_supabase_s3_url(monkeypatch) -> None:
    captured: dict[str, str] = {}

    def _fake_signed_url(settings, object_key):
        captured["object_key"] = object_key
        return f"https://cdn.example/{object_key}"

    monkeypatch.setattr(storage_url_service, "_create_s3_presigned_url", lambda settings, object_key: None)
    monkeypatch.setattr(storage_url_service, "_create_supabase_signed_url", _fake_signed_url)

    url = resolve_teacher_profile_photo_url(
        _settings(),
        "https://example.storage.supabase.co/storage/v1/s3/teacher-profile-photos/teachers/user/photo.jpg?X-Amz-Signature=old",
    )

    assert captured["object_key"] == "teachers/user/photo.jpg"
    assert url == "https://cdn.example/teachers/user/photo.jpg"


def test_resolve_teacher_profile_photo_url_keeps_external_url() -> None:
    url = "https://cdn.third-party.example/photo.jpg"

    assert resolve_teacher_profile_photo_url(_settings(), url) == url
