import os
from contextlib import AbstractContextManager
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("KIDARIO_SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault(
    "KIDARIO_DATABASE_URL",
    "postgresql+psycopg://postgres:postgres@localhost:5432/postgres",
)

from app.api.deps import get_current_admin, get_current_user
from app.api.v2.endpoints import reviews as reviews_endpoints
from app.core.security import AuthUser
from app.db.session import get_db
from app.main import app


NOW = "2026-05-26T10:00:00Z"


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
    auth_user = AuthUser(
        user_id="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        email="user@example.com",
        role="authenticated",
    )
    admin_user = AuthUser(
        user_id="bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        email="admin@example.com",
        role="authenticated",
    )
    app.dependency_overrides[get_current_user] = lambda: auth_user
    app.dependency_overrides[get_current_admin] = lambda: admin_user
    app.dependency_overrides[get_db] = lambda: _DummySession()
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def _review() -> dict:
    return {
        "id": UUID("99999999-9999-9999-9999-999999999999"),
        "booking_id": UUID("44444444-4444-4444-4444-444444444444"),
        "parent_id": UUID("11111111-1111-1111-1111-111111111111"),
        "teacher_id": UUID("22222222-2222-2222-2222-222222222222"),
        "rating": 5,
        "comment": "Excelente acompanhamento.",
        "feedback": {"punctuality": 5},
        "is_public": True,
        "status": "published",
        "submitted_at": NOW,
        "created_at": NOW,
        "updated_at": NOW,
    }


def _public_review() -> dict:
    return {
        "id": UUID("99999999-9999-9999-9999-999999999999"),
        "booking_id": UUID("44444444-4444-4444-4444-444444444444"),
        "teacher_id": UUID("22222222-2222-2222-2222-222222222222"),
        "rating": 5,
        "comment": "Excelente acompanhamento.",
        "submitted_at": NOW,
    }


def test_list_public_reviews_is_consolidated_by_teacher(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def _fake_list_public_reviews(db, *, teacher_id, limit, offset):
        assert teacher_id == UUID("22222222-2222-2222-2222-222222222222")
        assert limit == 10
        assert offset == 0
        return {"reviews": [_public_review()]}

    monkeypatch.setattr(reviews_endpoints, "list_public_reviews_v2", _fake_list_public_reviews)

    response = client.get("/api/v2/reviews?teacher_id=22222222-2222-2222-2222-222222222222&limit=10")

    assert response.status_code == 200
    body = response.json()
    assert body["reviews"][0]["rating"] == 5
    assert "parent_id" not in body["reviews"][0]


def test_create_and_read_booking_review(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def _fake_create_review(db, user, booking_id, payload):
        assert booking_id == UUID("44444444-4444-4444-4444-444444444444")
        assert payload.rating == 5
        return _review()

    monkeypatch.setattr(reviews_endpoints, "create_review_v2", _fake_create_review)
    monkeypatch.setattr(reviews_endpoints, "get_booking_review_v2", lambda db, user, booking_id: _review())

    create_response = client.post(
        "/api/v2/bookings/44444444-4444-4444-4444-444444444444/review",
        json={"rating": 5, "comment": "Excelente acompanhamento.", "feedback": {"punctuality": 5}},
    )
    read_response = client.get("/api/v2/bookings/44444444-4444-4444-4444-444444444444/review")

    assert create_response.status_code == 201
    assert read_response.status_code == 200
    assert create_response.json()["booking_id"] == "44444444-4444-4444-4444-444444444444"
    assert read_response.json()["feedback"]["punctuality"] == 5


def test_create_booking_review_rejects_empty_comment(client: TestClient) -> None:
    response = client.post(
        "/api/v2/bookings/44444444-4444-4444-4444-444444444444/review",
        json={"rating": 5, "comment": "   "},
    )

    assert response.status_code == 422


def test_admin_reviews_can_be_filtered_and_moderated(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def _fake_list_admin_reviews(db, *, status, teacher_id, parent_id, booking_id, limit, offset):
        assert status == "reported"
        assert teacher_id == UUID("22222222-2222-2222-2222-222222222222")
        assert parent_id is None
        assert booking_id is None
        assert limit == 100
        assert offset == 0
        return {"reviews": [{**_review(), "status": "reported"}]}

    def _fake_moderate_review(db, review_id, payload):
        assert review_id == UUID("99999999-9999-9999-9999-999999999999")
        assert payload.status == "hidden"
        return {**_review(), "status": "hidden", "is_public": False}

    monkeypatch.setattr(reviews_endpoints, "list_admin_reviews_v2", _fake_list_admin_reviews)
    monkeypatch.setattr(reviews_endpoints, "moderate_review_v2", _fake_moderate_review)

    list_response = client.get(
        "/api/v2/admin/reviews?status=reported&teacher_id=22222222-2222-2222-2222-222222222222"
    )
    patch_response = client.patch(
        "/api/v2/admin/reviews/99999999-9999-9999-9999-999999999999",
        json={"status": "hidden", "is_public": False},
    )

    assert list_response.status_code == 200
    assert patch_response.status_code == 200
    assert list_response.json()["reviews"][0]["status"] == "reported"
    assert patch_response.json()["is_public"] is False
