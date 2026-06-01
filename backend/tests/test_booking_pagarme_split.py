from types import SimpleNamespace
from uuid import UUID

import pytest

from app.services import booking_v2_service


class _MappingResult:
    def __init__(self, value):
        self.value = value

    def mappings(self):
        return self

    def first(self):
        return self.value


class _ProviderCustomerSession:
    def __init__(self, existing_customer_id: str | None = None) -> None:
        self.existing_customer_id = existing_customer_id
        self.executions: list[dict] = []

    def execute(self, statement, params=None):
        self.executions.append({"statement": str(statement), "params": params or {}})
        if "select provider_customer_id" in str(statement):
            return _MappingResult(
                {"provider_customer_id": self.existing_customer_id} if self.existing_customer_id else None
            )
        return _MappingResult(None)


def test_build_split_rules_requires_platform_recipient_when_pagarme_enabled(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        booking_v2_service,
        "get_settings",
        lambda: SimpleNamespace(
            pagarme_enabled=True,
            pagarme_platform_recipient_id=None,
            platform_fee_percent=20,
            parent_service_fee_percent=8,
        ),
    )

    with pytest.raises(booking_v2_service.BookingValidationError, match="PLATFORM_RECIPIENT_ID"):
        booking_v2_service._build_split_rules(
            db=SimpleNamespace(),
            teacher_id=UUID("33333333-3333-3333-3333-333333333333"),
            base_amount_cents=10000,
        )


def test_build_split_rules_rejects_pagarme_account_id_as_platform_recipient(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        booking_v2_service,
        "get_settings",
        lambda: SimpleNamespace(
            pagarme_enabled=True,
            pagarme_platform_recipient_id="acc_z1EvV71hOT14b5gw",
            platform_fee_percent=20,
            parent_service_fee_percent=8,
        ),
    )

    with pytest.raises(booking_v2_service.BookingValidationError, match="recipient id"):
        booking_v2_service._build_split_rules(
            db=SimpleNamespace(),
            teacher_id=UUID("33333333-3333-3333-3333-333333333333"),
            base_amount_cents=10000,
        )


def test_build_payment_pricing_adds_parent_fee_and_keeps_platform_share_from_base_amount(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        booking_v2_service,
        "get_settings",
        lambda: SimpleNamespace(
            platform_fee_percent=20.0,
            parent_service_fee_percent=8.0,
        ),
    )

    assert booking_v2_service._build_payment_pricing(32000) == {
        "base_amount_cents": 32000,
        "parent_service_fee_cents": 2560,
        "charge_amount_cents": 34560,
        "platform_amount_cents": 6400,
        "teacher_amount_cents": 28160,
    }


def test_base_amount_from_charge_amount_reverses_parent_service_fee(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        booking_v2_service,
        "get_settings",
        lambda: SimpleNamespace(parent_service_fee_percent=8.0),
    )

    assert booking_v2_service._base_amount_from_charge_amount(34560) == 32000


def test_build_split_rules_returns_exact_flat_amounts_over_parent_charge(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        booking_v2_service,
        "get_settings",
        lambda: SimpleNamespace(
            pagarme_enabled=True,
            pagarme_platform_recipient_id="rp_platform",
            platform_fee_percent=20.0,
            parent_service_fee_percent=8.0,
        ),
    )
    monkeypatch.setattr(booking_v2_service, "_resolve_teacher_recipient_id", lambda db, teacher_id: "rp_teacher")

    split_rules = booking_v2_service._build_split_rules(
        db=SimpleNamespace(),
        teacher_id=UUID("33333333-3333-3333-3333-333333333333"),
        base_amount_cents=10000,
    )

    assert [rule.recipient_id for rule in split_rules] == ["rp_platform", "rp_teacher"]
    assert [rule.type for rule in split_rules] == ["flat", "flat"]
    assert [rule.amount_cents for rule in split_rules] == [2000, 8800]
    assert sum(int(rule.amount_cents or 0) for rule in split_rules) == 10800
    assert split_rules[0].liable is True
    assert split_rules[0].charge_processing_fee is True


def test_credit_card_authorized_pending_capture_maps_to_authorized() -> None:
    fields = booking_v2_service._payment_fields_from_provider_response(
        {
            "id": "or_test",
            "code": "booking_123",
            "status": "pending",
            "amount": 12000,
            "charges": [
                {
                    "id": "ch_test",
                    "status": "pending",
                    "amount": 12000,
                    "last_transaction": {
                        "id": "tran_test",
                        "status": "authorized_pending_capture",
                        "acquirer_auth_code": "123456",
                        "card": {
                            "brand": "Visa",
                            "last_four_digits": "0010",
                            "holder_name": "Maria Silva",
                        },
                    },
                }
            ],
        },
        payment_method="credit_card",
        fallback_amount_cents=12000,
    )

    assert fields["order_status"] == "authorized"
    assert fields["charge_status"] == "authorized"
    assert fields["authorization_code"] == "123456"
    assert fields["card_last_four"] == "0010"


def test_credit_card_captured_charge_snapshot_maps_to_paid() -> None:
    fields = booking_v2_service._payment_fields_from_provider_response(
        {
            "id": "or_test",
            "code": "booking_123",
            "status": "paid",
            "amount": 12000,
            "paid_at": "2026-06-01T16:58:49Z",
            "charges": [
                {
                    "id": "ch_test",
                    "status": "paid",
                    "amount": 12000,
                    "paid_at": "2026-06-01T16:58:49Z",
                    "last_transaction": {
                        "id": "tran_test",
                        "status": "captured",
                        "operation_type": "capture",
                    },
                }
            ],
        },
        payment_method="credit_card",
        fallback_amount_cents=12000,
    )

    assert fields["order_status"] == "paid"
    assert fields["charge_status"] == "paid"
    assert fields["provider_charge_id"] == "ch_test"


def test_boleto_due_at_maps_to_charge_expiration() -> None:
    fields = booking_v2_service._payment_fields_from_provider_response(
        {
            "id": "or_test",
            "code": "booking_123",
            "status": "pending",
            "amount": 12000,
            "charges": [
                {
                    "id": "ch_test",
                    "status": "pending",
                    "amount": 12000,
                    "last_transaction": {
                        "id": "tran_test",
                        "status": "pending",
                        "due_at": "2026-06-04",
                        "line": "34191.79001 01043.510047 91020.150008 1 98760000012000",
                    },
                }
            ],
        },
        payment_method="boleto",
        fallback_amount_cents=12000,
    )

    assert fields["expires_at"].date().isoformat() == "2026-06-04"
    assert fields["boleto_line"] == "34191.79001 01043.510047 91020.150008 1 98760000012000"


def test_capture_or_sync_credit_card_charge_accepts_already_paid_provider_charge(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        booking_v2_service,
        "get_settings",
        lambda: SimpleNamespace(pagarme_enabled=True),
    )
    monkeypatch.setattr(
        booking_v2_service,
        "capture_charge",
        lambda settings, *, provider_charge_id, amount_cents: (_ for _ in ()).throw(
            booking_v2_service.PagarmeIntegrationError(
                'Pagar.me request failed (412): {"message":"This charge can not be captured."}'
            )
        ),
    )
    monkeypatch.setattr(
        booking_v2_service,
        "get_charge",
        lambda settings, *, provider_charge_id: {
            "id": provider_charge_id,
            "status": "paid",
            "amount": 32400,
            "paid_at": "2026-06-01T16:58:49Z",
            "order": {"id": "or_test", "code": "booking_123", "status": "paid"},
            "last_transaction": {"id": "tran_test", "status": "captured"},
        },
    )
    captured_update: dict[str, object] = {}

    def _fake_update_payment_order_from_provider_response(db, **kwargs):
        captured_update.update(kwargs)
        return {}

    monkeypatch.setattr(
        booking_v2_service,
        "_update_payment_order_from_provider_response",
        _fake_update_payment_order_from_provider_response,
    )

    booking_v2_service._capture_or_sync_credit_card_charge(
        db=SimpleNamespace(),
        payment_order={
            "id": UUID("55555555-5555-5555-5555-555555555555"),
            "provider_order_id": "or_test",
            "amount_cents": 32400,
        },
        charge={"provider_charge_id": "ch_test"},
        booking_id=UUID("44444444-4444-4444-4444-444444444444"),
    )

    assert captured_update["payment_order_id"] == UUID("55555555-5555-5555-5555-555555555555")
    assert captured_update["order_status"] == "paid"
    assert captured_update["charge_status"] == "paid"
    assert captured_update["provider_response"]["charges"][0]["id"] == "ch_test"


def test_credit_card_booking_requires_authorized_payment_record() -> None:
    with pytest.raises(booking_v2_service.BookingValidationError, match="autorizar o cartão"):
        booking_v2_service._ensure_credit_card_is_authorized({"order_status": "payment_failed"})


def test_credit_card_booking_accepts_authorized_payment_record() -> None:
    booking_v2_service._ensure_credit_card_is_authorized({"order_status": "authorized"})


def test_credit_card_token_is_converted_to_pagarme_card_id(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        booking_v2_service,
        "get_settings",
        lambda: SimpleNamespace(pagarme_enabled=True),
    )
    monkeypatch.setattr(
        booking_v2_service,
        "create_customer",
        lambda settings, *, customer: {"id": "cus_test"},
    )
    captured_card: dict[str, object] = {}

    def _fake_create_card(settings, *, customer_id, card_token, billing_address=None):
        captured_card["customer_id"] = customer_id
        captured_card["card_token"] = card_token
        captured_card["billing_address"] = billing_address
        return {"id": "card_test"}

    monkeypatch.setattr(booking_v2_service, "create_card", _fake_create_card)
    db = _ProviderCustomerSession()

    card_reference = booking_v2_service._resolve_pagarme_credit_card_reference(
        db,
        parent_id=UUID("11111111-1111-1111-1111-111111111111"),
        customer={
            "name": "Maria Silva",
            "email": "maria@example.com",
            "address": {"line_1": "1402, Rua da Consolacao"},
        },
        card_token="token_test",
        card_id=None,
    )

    assert card_reference == {"card_token": None, "card_id": "card_test", "customer_id": "cus_test"}
    assert captured_card == {
        "customer_id": "cus_test",
        "card_token": "token_test",
        "billing_address": {"line_1": "1402, Rua da Consolacao"},
    }
    assert any(
        execution["params"].get("provider_customer_id") == "cus_test"
        for execution in db.executions
    )
