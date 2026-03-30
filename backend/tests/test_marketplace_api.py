import os
from contextlib import AbstractContextManager

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("KIDARIO_SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault(
    "KIDARIO_DATABASE_URL",
    "postgresql+psycopg://postgres:postgres@localhost:5432/postgres",
)

from app.api.v1.endpoints import marketplace as marketplace_endpoints
from app.db.session import get_db
from app.main import app
from app.services.marketplace_service import MarketplaceNotFoundError


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


def test_get_marketplace_teachers_returns_list(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    def _fake_list_marketplace_teachers(db):
        return {
            "teachers": [
                {
                    "id": "3472def4-1d03-4350-b2c2-20c7fa27d430",
                    "name": "Ana Carolina Silva",
                    "avatar_url": "https://example.com/avatar.jpg",
                    "rating": 4.9,
                    "review_count": 28,
                    "price_per_class": 120.0,
                    "specialties": ["Alfabetizacao"],
                    "is_verified": True,
                    "is_online": True,
                    "is_presential": False,
                    "next_availability": "Hoje, 14h",
                    "experience_label": "Experiencia validada pela plataforma",
                    "bio_snippet": "Pedagoga com foco em alfabetizacao.",
                }
            ]
        }

    monkeypatch.setattr(marketplace_endpoints, "list_marketplace_teachers", _fake_list_marketplace_teachers)

    response = client.get("/api/v1/marketplace/teachers")

    assert response.status_code == 200
    body = response.json()
    assert "teachers" in body
    assert isinstance(body["teachers"], list)
    assert body["teachers"][0]["name"] == "Ana Carolina Silva"


def test_get_marketplace_teacher_detail_returns_404(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def _fake_get_marketplace_teacher_detail(db, teacher_profile_id):
        raise MarketplaceNotFoundError("Teacher not found in marketplace.")

    monkeypatch.setattr(
        marketplace_endpoints,
        "get_marketplace_teacher_detail",
        _fake_get_marketplace_teacher_detail,
    )

    response = client.get("/api/v1/marketplace/teachers/3472def4-1d03-4350-b2c2-20c7fa27d430")

    assert response.status_code == 404
    assert response.json()["detail"] == "Teacher not found in marketplace."


def test_get_marketplace_teacher_detail_returns_academic_history_and_experiences(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def _fake_get_marketplace_teacher_detail(db, teacher_profile_id):
        return {
            "id": "3472def4-1d03-4350-b2c2-20c7fa27d430",
            "name": "Ana Carolina Silva",
            "avatar_url": "https://example.com/avatar.jpg",
            "rating": 4.9,
            "review_count": 28,
            "price_per_class": 120.0,
            "specialties": ["Alfabetizacao"],
            "is_verified": True,
            "is_online": True,
            "is_presential": False,
            "experience_label": "2 experiencias registradas",
            "request_experience_anonymity": False,
            "bio": "Pedagoga com foco em alfabetizacao.",
            "city": "Sao Paulo",
            "state": "SP",
            "formations": [
                {
                    "id": "8e6fb361-8746-4484-b5c1-83059678e9e5",
                    "degree_type": "mestrado",
                    "course_name": "Psicopedagogia",
                    "institution": "Universidade Exemplo",
                    "completion_year": "2022",
                }
            ],
            "experiences": [
                {
                    "id": "5e657790-cf40-4d82-99df-f77b47ce1ad4",
                    "institution": "Colegio Exemplo",
                    "role": "Professora alfabetizadora",
                    "responsibilities": "Acompanhamento individual de leitura e escrita.",
                    "period_from": "2021-01",
                    "period_to": None,
                    "current_position": True,
                }
            ],
            "lesson_duration_minutes": 60,
            "next_slots": [],
        }

    monkeypatch.setattr(
        marketplace_endpoints,
        "get_marketplace_teacher_detail",
        _fake_get_marketplace_teacher_detail,
    )

    response = client.get("/api/v1/marketplace/teachers/3472def4-1d03-4350-b2c2-20c7fa27d430")

    assert response.status_code == 200
    body = response.json()
    assert body["request_experience_anonymity"] is False
    assert len(body["formations"]) == 1
    assert body["formations"][0]["course_name"] == "Psicopedagogia"
    assert len(body["experiences"]) == 1
    assert body["experiences"][0]["role"] == "Professora alfabetizadora"
