from types import SimpleNamespace
from uuid import UUID

import pytest

from app.services import booking_v2_service


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
        ),
    )

    with pytest.raises(booking_v2_service.BookingValidationError, match="PLATFORM_RECIPIENT_ID"):
        booking_v2_service._build_split_rules(
            db=SimpleNamespace(),
            teacher_id=UUID("33333333-3333-3333-3333-333333333333"),
            amount_cents=10000,
        )


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
