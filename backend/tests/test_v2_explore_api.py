import os
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("KIDARIO_SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault(
    "KIDARIO_DATABASE_URL",
    "postgresql+psycopg://postgres:postgres@localhost:5432/postgres",
)

from app.api.v2.endpoints import explore as explore_endpoints
from app.db.session import get_db
from app.main import app


NOW = "2026-05-26T10:00:00Z"


class _DummySession:
    pass


@pytest.fixture
def client() -> TestClient:
    app.dependency_overrides[get_db] = lambda: _DummySession()
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def _teacher_search_result() -> dict:
    return {
        "teacher_id": UUID("11111111-1111-1111-1111-111111111111"),
        "display_name": "Ana Silva",
        "biography_preview": "Apoio pedagogico especializado.",
        "profile_photo_url": "https://cdn.example/ana.jpg",
        "location": {
            "city": "Sao Paulo",
            "state": "SP",
            "country": "BR",
            "distance_km": 3.2,
        },
        "modality": "ambos",
        "hourly_rate_cents": 12000,
        "lesson_duration_minutes": 60,
        "skills": ["alfabetizacao"],
        "rating_summary": {"average": 4.8, "count": 12},
        "availability_summary": {
            "next_available_at": "2026-05-28T15:00:00Z",
            "preview_slots": [
                {
                    "starts_at": "2026-05-28T15:00:00Z",
                    "duration_minutes": 60,
                    "modality": "online",
                }
            ],
            "range_days": None,
        },
        "package_summary": {
            "has_packages": True,
            "starting_estimated_amount_cents": 43200,
            "max_discount_percent": 10,
        },
        "latest_review": {
            "id": UUID("22222222-2222-2222-2222-222222222222"),
            "rating": 5,
            "comment": "Excelente.",
            "submitted_at": NOW,
        },
    }


def test_get_v2_explore_teachers_accepts_discovery_filters(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def _fake_list_explore_teachers(db, **kwargs):
        assert kwargs["query"] == "matematica"
        assert kwargs["modality"] == "online"
        assert kwargs["min_rating"] == 4
        assert kwargs["has_reviews"] is True
        assert kwargs["sort"] == "soonest_available"
        return {"teachers": [_teacher_search_result()]}

    monkeypatch.setattr(explore_endpoints, "list_explore_teachers", _fake_list_explore_teachers)

    response = client.get(
        "/api/v2/explore/teachers"
        "?query=matematica&modality=online&min_rating=4&has_reviews=true&sort=soonest_available"
    )

    assert response.status_code == 200
    body = response.json()
    assert body["teachers"][0]["teacher_id"] == "11111111-1111-1111-1111-111111111111"
    assert body["teachers"][0]["rating_summary"]["average"] == 4.8
    assert body["teachers"][0]["availability_summary"]["preview_slots"][0]["modality"] == "online"
    assert body["teachers"][0]["package_summary"]["has_packages"] is True


def test_get_v2_explore_teacher_detail_is_self_contained(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def _fake_get_explore_teacher_detail(db, teacher_id, **kwargs):
        result = _teacher_search_result()
        return {
            "teacher_id": teacher_id,
            "display_name": result["display_name"],
            "biography": "Bio completa",
            "profile_photo_url": result["profile_photo_url"],
            "location": result["location"],
            "modality": result["modality"],
            "hourly_rate_cents": result["hourly_rate_cents"],
            "lesson_duration_minutes": result["lesson_duration_minutes"],
            "skills": result["skills"],
            "academic_records": [],
            "experiences": [],
            "rating_summary": result["rating_summary"],
            "availability_summary": {**result["availability_summary"], "range_days": 14},
            "package_summary": result["package_summary"],
            "package_plans": [
                {
                    "id": UUID("33333333-3333-3333-3333-333333333333"),
                    "code": "PACK4",
                    "name": "Pacote 4 aulas",
                    "description": None,
                    "sessions_count": 4,
                    "discount_percent": 10,
                    "estimated_original_amount_cents": 48000,
                    "estimated_final_amount_cents": 43200,
                    "currency": "BRL",
                    "is_active": True,
                }
            ],
            "latest_reviews": [result["latest_review"]],
        }

    monkeypatch.setattr(explore_endpoints, "get_explore_teacher_detail", _fake_get_explore_teacher_detail)

    response = client.get("/api/v2/explore/teachers/11111111-1111-1111-1111-111111111111")

    assert response.status_code == 200
    body = response.json()
    assert body["teacher_id"] == "11111111-1111-1111-1111-111111111111"
    assert body["availability_summary"]["preview_slots"]
    assert body["latest_reviews"][0]["rating"] == 5
    assert body["package_plans"][0]["estimated_final_amount_cents"] == 43200
