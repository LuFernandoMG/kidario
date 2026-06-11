import os
from contextlib import AbstractContextManager
from types import SimpleNamespace
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("KIDARIO_SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault(
    "KIDARIO_DATABASE_URL",
    "postgresql+psycopg://postgres:postgres@localhost:5432/postgres",
)

from app.api.deps import get_current_teacher_user, get_current_user
from app.api.v2.endpoints import bookings as bookings_endpoints
from app.api.v2.endpoints import payments as payments_endpoints
from app.core.security import AuthUser
from app.db.session import get_db
from app.main import app
from app.schemas.v2_payments import TeacherPayoutProfileUpsertRequest
from app.services import payment_v2_service


NOW = "2026-05-26T10:00:00Z"


class _DummyTransaction(AbstractContextManager[None]):
    def __enter__(self) -> None:
        return None

    def __exit__(self, exc_type, exc, tb) -> bool:
        return False


class _DummySession:
    def begin(self) -> _DummyTransaction:
        return _DummyTransaction()


class _ActiveDummySession(_DummySession):
    def __init__(self) -> None:
        self.commits = 0
        self.rollbacks = 0

    def in_transaction(self) -> bool:
        return True

    def commit(self) -> None:
        self.commits += 1

    def rollback(self) -> None:
        self.rollbacks += 1


class _MappingResult:
    def __init__(self, value: dict) -> None:
        self.value = value

    def mappings(self):
        return self

    def first(self):
        return self.value


class _PayoutUpsertSession:
    def execute(self, statement, params=None):
        return _MappingResult(_payout_profile())


@pytest.fixture
def client() -> TestClient:
    auth_user = AuthUser(
        user_id="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        email="parent@example.com",
        role="authenticated",
    )
    app.dependency_overrides[get_current_user] = lambda: auth_user
    app.dependency_overrides[get_current_teacher_user] = lambda: auth_user
    app.dependency_overrides[get_db] = lambda: _DummySession()

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


def _payment_order() -> dict:
    return {
        "id": UUID("55555555-5555-5555-5555-555555555555"),
        "parent_id": UUID("11111111-1111-1111-1111-111111111111"),
        "booking_id": UUID("44444444-4444-4444-4444-444444444444"),
        "package_id": None,
        "provider": "legacy",
        "provider_order_id": None,
        "provider_order_code": None,
        "amount_cents": 12000,
        "currency": "BRL",
        "status": "pending",
        "charges": [
            {
                "id": UUID("66666666-6666-6666-6666-666666666666"),
                "payment_order_id": UUID("55555555-5555-5555-5555-555555555555"),
                "provider": "legacy",
                "provider_charge_id": None,
                "provider_transaction_id": None,
                "payment_method": "pix",
                "status": "pending",
                "amount_cents": 12000,
                "paid_amount_cents": None,
                "installments": 1,
                "pix_qr_code_url": None,
                "boleto_url": None,
                "paid_at": None,
                "failed_at": None,
                "canceled_at": None,
                "refunded_at": None,
                "created_at": NOW,
                "updated_at": NOW,
            }
        ],
        "created_at": NOW,
        "updated_at": NOW,
    }


def _payout_profile() -> dict:
    return {
        "id": UUID("88888888-8888-8888-8888-888888888888"),
        "teacher_id": UUID("33333333-3333-3333-3333-333333333333"),
        "legal_name": "Ana Silva",
        "document_type": "cpf",
        "document_number_masked": "*********01",
        "bank_code": "260",
        "branch_number": "0001",
        "branch_check_digit": None,
        "account_number_masked": "****6789",
        "account_check_digit": None,
        "account_type": "checking",
        "birthdate": "1984-10-30",
        "monthly_income_cents": 350000,
        "professional_occupation": "Professor(a)",
        "status": "pending",
        "provider": None,
        "provider_recipient_id": None,
        "recipient_status": None,
        "created_at": NOW,
        "updated_at": NOW,
    }


def _booking() -> dict:
    return {
        "id": UUID("44444444-4444-4444-4444-444444444444"),
        "parent_id": UUID("11111111-1111-1111-1111-111111111111"),
        "child_id": UUID("22222222-2222-2222-2222-222222222222"),
        "teacher_id": UUID("33333333-3333-3333-3333-333333333333"),
        "package_id": None,
        "starts_at": "2026-05-28T15:00:00Z",
        "duration_minutes": 60,
        "modality": "online",
        "status": "pendente",
        "teacher_decision_status": "pending",
        "teacher_decision_reason": None,
        "teacher_decision_at": None,
        "payment_flow_status": "awaiting_payment",
        "cancellation_reason": None,
        "confirmed_at": None,
        "completed_at": None,
        "canceled_at": None,
        "created_at": NOW,
        "updated_at": NOW,
        "child": {"id": UUID("22222222-2222-2222-2222-222222222222"), "name": "Lucas"},
        "teacher": {
            "id": UUID("33333333-3333-3333-3333-333333333333"),
            "display_name": "Ana Silva",
            "profile_photo_url": "https://cdn.example/ana.jpg",
        },
        "parent": {"id": UUID("11111111-1111-1111-1111-111111111111"), "display_name": "Maria Silva"},
        "payment_order": _payment_order(),
        "latest_follow_up": None,
        "actions": {
            "can_reschedule": True,
            "can_cancel": True,
            "can_complete": False,
            "can_review": False,
        },
    }


def _webhook_settings(
    *,
    username: str | None = "pagarme-user",
    password: str | None = "pagarme-pass",
) -> SimpleNamespace:
    return SimpleNamespace(
        pagarme_webhook_basic_username=username,
        pagarme_webhook_basic_password=password,
    )


def test_post_v2_booking_returns_normalized_booking(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def _fake_create_booking_v2(db, user, payload):
        assert payload.teacher_id == UUID("33333333-3333-3333-3333-333333333333")
        return _booking()

    monkeypatch.setattr(bookings_endpoints, "create_booking_v2", _fake_create_booking_v2)

    response = client.post(
        "/api/v2/bookings",
        json={
            "teacher_id": "33333333-3333-3333-3333-333333333333",
            "child_id": "22222222-2222-2222-2222-222222222222",
            "starts_at": "2026-05-28T15:00:00Z",
            "duration_minutes": 60,
            "modality": "online",
            "payment_method": "pix",
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["id"] == "44444444-4444-4444-4444-444444444444"
    assert body["payment_order"]["charges"][0]["payment_method"] == "pix"
    assert body["teacher"]["display_name"] == "Ana Silva"


def test_post_v2_booking_accepts_package_id(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def _fake_create_booking_v2(db, user, payload):
        assert payload.package_id == UUID("77777777-7777-7777-7777-777777777777")
        booking = _booking()
        booking["package_id"] = payload.package_id
        booking["payment_order"] = {
            **_payment_order(),
            "amount_cents": 0,
            "status": "paid",
            "charges": [{**_payment_order()["charges"][0], "amount_cents": 0, "status": "paid"}],
        }
        return booking

    monkeypatch.setattr(bookings_endpoints, "create_booking_v2", _fake_create_booking_v2)

    response = client.post(
        "/api/v2/bookings",
        json={
            "teacher_id": "33333333-3333-3333-3333-333333333333",
            "child_id": "22222222-2222-2222-2222-222222222222",
            "package_id": "77777777-7777-7777-7777-777777777777",
            "starts_at": "2026-05-28T15:00:00Z",
            "duration_minutes": 60,
            "modality": "online",
        },
    )

    assert response.status_code == 201
    assert response.json()["package_id"] == "77777777-7777-7777-7777-777777777777"
    assert response.json()["payment_order"]["amount_cents"] == 0


def test_post_v2_booking_requires_payment_method_without_package(client: TestClient) -> None:
    response = client.post(
        "/api/v2/bookings",
        json={
            "teacher_id": "33333333-3333-3333-3333-333333333333",
            "child_id": "22222222-2222-2222-2222-222222222222",
            "starts_at": "2026-05-28T15:00:00Z",
            "duration_minutes": 60,
            "modality": "online",
        },
    )

    assert response.status_code == 422


def test_get_v2_parent_bookings_uses_parent_namespace(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        bookings_endpoints,
        "list_parent_bookings_v2",
        lambda db, user, **kwargs: {"bookings": [_booking()]},
    )

    response = client.get("/api/v2/parents/me/bookings")

    assert response.status_code == 200
    assert response.json()["bookings"][0]["child"]["name"] == "Lucas"


def test_post_v2_booking_decision_uses_teacher_decision_contract(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def _fake_decide_booking_v2(db, user, booking_id, payload):
        assert payload.decision == "accept"
        booking = _booking()
        booking["status"] = "confirmada"
        return booking

    monkeypatch.setattr(bookings_endpoints, "decide_booking_v2", _fake_decide_booking_v2)

    response = client.post(
        "/api/v2/bookings/44444444-4444-4444-4444-444444444444/decision",
        json={"decision": "accept"},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "confirmada"


def test_get_v2_booking_payment_returns_order_with_charges(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(payments_endpoints, "get_booking_payment_v2", lambda db, user, booking_id: _payment_order())

    response = client.get("/api/v2/bookings/44444444-4444-4444-4444-444444444444/payment")

    assert response.status_code == 200
    body = response.json()
    assert body["amount_cents"] == 12000
    assert body["charges"][0]["status"] == "pending"


def test_get_v2_parent_payments(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(payments_endpoints, "list_parent_payments_v2", lambda db, user, limit, offset: {"payments": [_payment_order()]})

    response = client.get("/api/v2/parents/me/payments")

    assert response.status_code == 200
    assert response.json()["payments"][0]["provider"] == "legacy"


def test_pagarme_webhook_returns_503_when_basic_auth_is_not_configured(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        payments_endpoints,
        "get_settings",
        lambda: _webhook_settings(username=None, password=None),
    )

    response = client.post("/api/v2/payments/pagarme/webhook", json={"type": "order.paid"})

    assert response.status_code == 503
    assert response.json()["detail"] == "Pagar.me webhook Basic Auth is not configured."


def test_pagarme_webhook_requires_basic_auth_credentials(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(payments_endpoints, "get_settings", lambda: _webhook_settings())

    missing_response = client.post("/api/v2/payments/pagarme/webhook", json={"type": "order.paid"})
    wrong_response = client.post(
        "/api/v2/payments/pagarme/webhook",
        json={"type": "order.paid"},
        auth=("pagarme-user", "wrong-pass"),
    )

    assert missing_response.status_code == 401
    assert missing_response.headers["www-authenticate"] == "Basic"
    assert wrong_response.status_code == 401
    assert wrong_response.headers["www-authenticate"] == "Basic"


def test_pagarme_webhook_accepts_valid_basic_auth(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    active_session = _ActiveDummySession()
    app.dependency_overrides[get_db] = lambda: active_session
    captured: dict[str, object] = {}
    monkeypatch.setattr(payments_endpoints, "get_settings", lambda: _webhook_settings())

    def _fake_process_pagarme_webhook_v2(db, payload):
        captured["db"] = db
        captured["payload"] = payload
        return {"status": "ok", "event_id": None}

    monkeypatch.setattr(payments_endpoints, "process_pagarme_webhook_v2", _fake_process_pagarme_webhook_v2)

    response = client.post(
        "/api/v2/payments/pagarme/webhook",
        json={"type": "order.paid"},
        auth=("pagarme-user", "pagarme-pass"),
    )

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "event_id": None}
    assert captured == {"db": active_session, "payload": {"type": "order.paid"}}
    assert active_session.commits == 1
    assert active_session.rollbacks == 0


def test_patch_teacher_payout_profile_commits_existing_transaction(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    active_session = _ActiveDummySession()
    app.dependency_overrides[get_db] = lambda: active_session

    def _fake_upsert_teacher_payout_profile_v2(db, user, payload):
        assert db is active_session
        assert payload.bank_code == "260"
        assert payload.branch_check_digit is None
        assert payload.account_check_digit is None
        return _payout_profile()

    monkeypatch.setattr(
        payments_endpoints,
        "upsert_teacher_payout_profile_v2",
        _fake_upsert_teacher_payout_profile_v2,
    )

    response = client.patch(
        "/api/v2/teachers/me/payout-profile",
        json={
            "legal_name": "Ana Silva",
            "document_type": "cpf",
            "document_number": "12345678901",
            "bank_code": "260",
            "branch_number": "0001",
            "account_number": "123456789",
            "account_type": "checking",
            "birthdate": "1984-10-30",
            "monthly_income_cents": 350000,
            "professional_occupation": "Professor(a)",
        },
    )

    assert response.status_code == 200
    assert response.json()["bank_code"] == "260"
    assert active_session.commits == 1
    assert active_session.rollbacks == 0


def test_upsert_teacher_payout_profile_requires_password(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        payment_v2_service,
        "_require_teacher",
        lambda db, user: UUID("33333333-3333-3333-3333-333333333333"),
    )

    payload = TeacherPayoutProfileUpsertRequest(
        legal_name="Ana Silva",
        document_type="cpf",
        document_number="12345678901",
        bank_code="260",
        branch_number="0001",
        account_number="123456789",
        account_type="checking",
        birthdate="1984-10-30",
        monthly_income_cents=350000,
        professional_occupation="Professor(a)",
    )

    with pytest.raises(payment_v2_service.PaymentValidationError, match="senha"):
        payment_v2_service.upsert_teacher_payout_profile_v2(
            _PayoutUpsertSession(),
            AuthUser(user_id="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", email="ana@example.com"),
            payload,
        )


def test_upsert_teacher_payout_profile_verifies_password(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        payment_v2_service,
        "_require_teacher",
        lambda db, user: UUID("33333333-3333-3333-3333-333333333333"),
    )
    captured: dict[str, str | None] = {}

    def _fake_verify_password(settings, *, email, password, expected_user_id):
        captured["email"] = email
        captured["password"] = password
        captured["expected_user_id"] = expected_user_id

    monkeypatch.setattr(payment_v2_service, "verify_supabase_password", _fake_verify_password)

    payload = TeacherPayoutProfileUpsertRequest(
        legal_name="Ana Silva",
        document_type="cpf",
        document_number="12345678901",
        bank_code="260",
        branch_number="0001",
        account_number="123456789",
        account_type="checking",
        birthdate="1984-10-30",
        monthly_income_cents=350000,
        professional_occupation="Professor(a)",
        current_password="secret-pass",
    )

    data = payment_v2_service.upsert_teacher_payout_profile_v2(
        _PayoutUpsertSession(),
        AuthUser(user_id="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", email="ana@example.com"),
        payload,
    )

    assert data["bank_code"] == "260"
    assert captured == {
        "email": "ana@example.com",
        "password": "secret-pass",
        "expected_user_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    }
