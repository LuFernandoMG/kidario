from types import SimpleNamespace

import pytest

from app.services import pagarme_service
from app.services.pagarme_service import PagarmeIntegrationError, PagarmeSplitRule, create_order, create_recipient


def _payout_profile(**overrides):
    data = {
        "teacher_id": "teacher-123",
        "legal_name": "Ana Silva",
        "email": "ana@example.com",
        "phone": "11999998888",
        "document_type": "cpf",
        "document_number": "12345678901",
        "birthdate": "1984-10-30",
        "monthly_income_cents": 350000,
        "professional_occupation": "Professor(a)",
        "address_street": "Rua da Consolacao",
        "address_number": "1402",
        "address_complement": None,
        "address_district": "Consolacao",
        "address_city": "Sao Paulo",
        "address_state": "SP",
        "address_postal_code": "01302000",
        "address_country": "BR",
        "bank_code": "341",
        "branch_number": "1234",
        "branch_check_digit": "6",
        "account_number": "12345",
        "account_check_digit": "7",
        "account_type": "checking",
    }
    data.update(overrides)
    return data


def test_create_recipient_uses_v5_register_information_payload(monkeypatch) -> None:
    captured: dict[str, object] = {}

    def _fake_json_request(settings, *, method, path, body=None):
        captured["method"] = method
        captured["path"] = path
        captured["body"] = body
        return {"id": "rp_test", "status": "active"}

    monkeypatch.setattr(pagarme_service, "_json_request", _fake_json_request)

    response = create_recipient(
        SimpleNamespace(pagarme_enabled=True),
        payout_profile=_payout_profile(),
    )

    assert response["id"] == "rp_test"
    assert captured["method"] == "POST"
    assert captured["path"] == "/recipients"
    body = captured["body"]
    assert body["code"] == "teacher-123"
    assert body["register_information"] == {
        "name": "Ana Silva",
        "email": "ana@example.com",
        "document": "12345678901",
        "type": "individual",
        "site_url": "https://use.kidario.app",
        "birthdate": "30/10/1984",
        "monthly_income": 350000,
        "professional_occupation": "Professor(a)",
        "address": {
            "street": "Rua da Consolacao",
            "complementary": "S/N",
            "street_number": "1402",
            "neighborhood": "Consolacao",
            "city": "Sao Paulo",
            "state": "SP",
            "zip_code": "01302000",
            "reference_point": "Nao informado",
        },
        "phone_numbers": [{"ddd": "11", "number": "999998888", "type": "primary"}],
    }
    assert body["default_bank_account"]["holder_document"] == "12345678901"
    assert body["default_bank_account"]["type"] == "checking"


def test_create_recipient_omits_blank_optional_bank_digits(monkeypatch) -> None:
    captured: dict[str, object] = {}

    def _fake_json_request(settings, *, method, path, body=None):
        captured["body"] = body
        return {"id": "rp_test", "status": "active"}

    monkeypatch.setattr(pagarme_service, "_json_request", _fake_json_request)

    create_recipient(
        SimpleNamespace(pagarme_enabled=True),
        payout_profile=_payout_profile(
            phone="+55 (11) 93333-4444",
            bank_code="260",
            branch_number="0001",
            branch_check_digit=None,
            account_check_digit="",
        ),
    )

    bank_account = captured["body"]["default_bank_account"]
    assert "branch_check_digit" not in bank_account
    assert "account_check_digit" not in bank_account


def test_create_recipient_requires_phone_with_ddd_when_enabled() -> None:
    with pytest.raises(PagarmeIntegrationError, match="phone"):
        create_recipient(
            SimpleNamespace(pagarme_enabled=True),
            payout_profile=_payout_profile(phone="9999"),
        )


def test_create_recipient_requires_individual_kyc_fields_when_enabled() -> None:
    with pytest.raises(PagarmeIntegrationError, match="monthly income"):
        create_recipient(
            SimpleNamespace(pagarme_enabled=True),
            payout_profile=_payout_profile(monthly_income_cents=None),
        )


def test_create_order_sends_card_token_with_billing_address(monkeypatch) -> None:
    captured: dict[str, object] = {}

    def _fake_json_request(settings, *, method, path, body=None):
        captured["method"] = method
        captured["path"] = path
        captured["body"] = body
        return {"id": "or_test", "status": "pending"}

    monkeypatch.setattr(pagarme_service, "_json_request", _fake_json_request)

    create_order(
        SimpleNamespace(pagarme_enabled=True),
        order_code="booking_123",
        amount_cents=12000,
        payment_method="credit_card",
        customer={
            "name": "Maria Silva",
            "email": "maria@example.com",
            "address": {
                "line_1": "1402, Rua da Consolacao, Consolacao",
                "line_2": "Apto 12",
                "zip_code": "01302000",
                "city": "Sao Paulo",
                "state": "SP",
                "country": "BR",
            },
        },
        item_description="Aula Kidario",
        split_rules=[
            PagarmeSplitRule(
                recipient_id="rp_teacher",
                split_role="teacher",
                type="percentage",
                percentage=80,
            )
        ],
        card_token="card_token_test",
        installments=2,
        capture=False,
    )

    body = captured["body"]
    assert captured["method"] == "POST"
    assert captured["path"] == "/orders"
    assert body["billing_address"] == {
        "line_1": "1402, Rua da Consolacao, Consolacao",
        "line_2": "Apto 12",
        "zip_code": "01302000",
        "city": "Sao Paulo",
        "state": "SP",
        "country": "BR",
    }
    credit_card = body["payments"][0]["credit_card"]
    assert credit_card["operation_type"] == "auth_only"
    assert credit_card["installments"] == 2
    assert credit_card["card_token"] == "card_token_test"
