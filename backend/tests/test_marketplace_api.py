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
