from uuid import UUID

from app.core.security import AuthUser
from app.services import payment_v2_service


class _MappingResult:
    def __init__(self, value):
        self.value = value

    def mappings(self):
        return self

    def first(self):
        return self.value


class _RecipientSyncSession:
    def __init__(self) -> None:
        self.executions = []

    def execute(self, statement, params=None):
        statement_text = str(statement)
        self.executions.append({"statement": statement_text, "params": params or {}})
        if "from teacher_payout_profiles" in statement_text:
            return _MappingResult(
                {
                    "teacher_id": UUID("33333333-3333-3333-3333-333333333333"),
                    "document_type": "cpf",
                    "document_number": "12345678901",
                    "legal_name": "Ana Silva",
                    "existing_provider_recipient_id": "rp_teacher",
                    "existing_recipient_status": "pending",
                }
            )
        return _MappingResult(None)


def test_recipient_status_uses_active_gateway_recipient_when_top_level_status_is_missing() -> None:
    assert (
        payment_v2_service._recipient_status_from_provider_response(
            {
                "id": "rp_teacher",
                "gateway_recipients": [
                    {"gateway": "pagarme", "status": "active"},
                ],
                "default_bank_account": {"status": "active"},
            }
        )
        == "active"
    )


def test_recipient_status_keeps_pending_without_active_provider_signal() -> None:
    assert (
        payment_v2_service._recipient_status_from_provider_response(
            {
                "id": "rp_teacher",
                "status": "pending",
                "default_bank_account": {"status": "active"},
            }
        )
        == "pending"
    )


def test_webhook_id_helpers_accept_charge_paid_payloads() -> None:
    payload = {
        "id": "ch_test",
        "status": "paid",
        "amount": 12000,
        "order": {"id": "or_test"},
    }

    assert payment_v2_service._provider_order_id_from_event("charge.paid", payload) == "or_test"
    assert payment_v2_service._provider_charge_id_from_event("charge.paid", payload) == "ch_test"
    assert payment_v2_service._event_paid_amount_cents(payload, 0) == 12000


def test_webhook_id_helpers_accept_order_paid_payloads_with_charges() -> None:
    payload = {
        "id": "or_test",
        "status": "paid",
        "charges": [{"id": "ch_test", "status": "paid", "paid_amount": 12000}],
    }

    assert payment_v2_service._provider_order_id_from_event("order.paid", payload) == "or_test"
    assert payment_v2_service._provider_charge_id_from_event("order.paid", payload) == "ch_test"
    assert payment_v2_service._event_paid_amount_cents(payload, 0) == 12000


def test_webhook_status_merge_does_not_regress_paid_pix_or_boleto_to_pending() -> None:
    assert payment_v2_service._merge_payment_status("paid", "pending") == "paid"
    assert payment_v2_service._merge_payment_status("paid", "expired") == "paid"
    assert payment_v2_service._merge_payment_status("pending", "paid") == "paid"


def test_sync_teacher_payment_recipient_refreshes_existing_pending_recipient(monkeypatch) -> None:
    monkeypatch.setattr(
        payment_v2_service,
        "_require_teacher",
        lambda db, user: UUID("33333333-3333-3333-3333-333333333333"),
    )
    monkeypatch.setattr(payment_v2_service, "get_settings", lambda: object())
    monkeypatch.setattr(
        payment_v2_service,
        "get_recipient",
        lambda settings, *, provider_recipient_id: {
            "id": provider_recipient_id,
            "gateway_recipients": [{"status": "active"}],
        },
    )

    def _unexpected_create_recipient(settings, *, payout_profile):
        raise AssertionError("Existing pending recipient should be refreshed before creating a new recipient.")

    monkeypatch.setattr(payment_v2_service, "create_recipient", _unexpected_create_recipient)

    result = payment_v2_service.sync_teacher_payment_recipient_v2(
        _RecipientSyncSession(),
        AuthUser(user_id="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", email="ana@example.com"),
    )

    assert result["provider_recipient_id"] == "rp_teacher"
    assert result["recipient_status"] == "active"
