import base64
import json
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib import error, request
from uuid import uuid4

from app.core.config import Settings
from app.core.ssl_utils import build_ssl_context


class PagarmeIntegrationError(Exception):
    pass


@dataclass(frozen=True)
class PagarmeSplitRule:
    recipient_id: str
    split_role: str
    type: str
    amount_cents: int | None = None
    percentage: float | None = None
    liable: bool = False
    charge_processing_fee: bool = False
    charge_remainder_fee: bool = False


def _json_request(
    settings: Settings,
    *,
    method: str,
    path: str,
    body: dict[str, Any] | None = None,
) -> dict[str, Any]:
    if not settings.pagarme_secret_key:
        raise PagarmeIntegrationError("Pagar.me secret key is not configured.")

    credentials = base64.b64encode(f"{settings.pagarme_secret_key}:".encode("utf-8")).decode("ascii")
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = request.Request(
        url=f"{settings.pagarme_base_url.rstrip('/')}/{path.lstrip('/')}",
        data=data,
        method=method,
        headers={
            "Authorization": f"Basic {credentials}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        },
    )
    ssl_context = build_ssl_context(settings.pagarme_ca_bundle)
    try:
        with request.urlopen(req, timeout=settings.pagarme_timeout_seconds, context=ssl_context) as response:
            payload_raw = response.read().decode("utf-8")
            return json.loads(payload_raw) if payload_raw else {}
    except error.HTTPError as exc:
        payload_raw = exc.read().decode("utf-8") if exc.fp is not None else ""
        detail = payload_raw or str(exc)
        raise PagarmeIntegrationError(f"Pagar.me request failed ({exc.code}): {detail}") from exc
    except error.URLError as exc:
        raise PagarmeIntegrationError(f"Could not reach Pagar.me: {exc.reason}") from exc


def _split_payload(split_rules: list[PagarmeSplitRule]) -> list[dict[str, Any]]:
    payload = []
    for split in split_rules:
        item = {
            "recipient_id": split.recipient_id,
            "type": split.type,
            "options": {
                "liable": split.liable,
                "charge_processing_fee": split.charge_processing_fee,
                "charge_remainder_fee": split.charge_remainder_fee,
            },
        }
        if split.type == "flat":
            item["amount"] = split.amount_cents or 0
        else:
            item["percentage"] = split.percentage or 0
        payload.append(item)
    return payload


def _fake_order_response(
    *,
    order_code: str,
    amount_cents: int,
    payment_method: str,
    status: str,
    charge_status: str,
    split_rules: list[PagarmeSplitRule],
) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    charge_id = f"ch_fake_{uuid4().hex[:24]}"
    expires_at = now + timedelta(hours=24 if payment_method == "pix" else 72)
    charge: dict[str, Any] = {
        "id": charge_id,
        "code": charge_id,
        "status": charge_status,
        "amount": amount_cents,
        "paid_amount": amount_cents if charge_status == "paid" else 0,
        "payment_method": payment_method,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
        "expires_at": expires_at.isoformat(),
        "last_transaction": {
            "id": f"tran_fake_{uuid4().hex[:24]}",
            "status": charge_status,
            "authorization_code": "FAKEAUTH" if payment_method == "credit_card" else None,
            "qr_code": "000201fakepixkidario",
            "qr_code_url": "https://example.invalid/pix-qr-code.png",
            "url": "https://example.invalid/boleto",
            "line": "34191.79001 01043.510047 91020.150008 1 98760000012000",
            "barcode": "34191987600000120001790010104351004791020150",
            "card": {
                "brand": "Visa",
                "last_four_digits": "4242",
                "holder_name": "Cliente Kidario",
            },
        },
    }
    return {
        "id": f"or_fake_{uuid4().hex[:24]}",
        "code": order_code,
        "status": status,
        "amount": amount_cents,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
        "charges": [charge],
        "split": [rule.__dict__ for rule in split_rules],
    }


def create_order(
    settings: Settings,
    *,
    order_code: str,
    amount_cents: int,
    payment_method: str,
    customer: dict[str, Any],
    item_description: str,
    split_rules: list[PagarmeSplitRule],
    card_token: str | None = None,
    card_id: str | None = None,
    installments: int = 1,
    capture: bool = False,
) -> dict[str, Any]:
    if not settings.pagarme_enabled:
        status = "paid" if capture and payment_method == "credit_card" else "authorized" if payment_method == "credit_card" else "pending"
        charge_status = status
        return _fake_order_response(
            order_code=order_code,
            amount_cents=amount_cents,
            payment_method=payment_method,
            status=status,
            charge_status=charge_status,
            split_rules=split_rules,
        )

    payment: dict[str, Any] = {
        "payment_method": payment_method,
        "split": _split_payload(split_rules),
    }
    if payment_method == "credit_card":
        credit_card: dict[str, Any] = {
            "operation_type": "auth_and_capture" if capture else "auth_only",
            "installments": installments,
        }
        if card_id:
            credit_card["card_id"] = card_id
        else:
            credit_card["card_token"] = card_token
        payment["credit_card"] = credit_card
    elif payment_method == "pix":
        payment["pix"] = {"expires_in": 24 * 60 * 60}
    elif payment_method == "boleto":
        payment["boleto"] = {"instructions": "Pagamento Kidario", "due_at": (datetime.now(timezone.utc) + timedelta(days=3)).date().isoformat()}
    else:
        raise PagarmeIntegrationError(f"Unsupported payment method: {payment_method}")

    return _json_request(
        settings,
        method="POST",
        path="/orders",
        body={
            "code": order_code,
            "customer": customer,
            "items": [
                {
                    "amount": amount_cents,
                    "description": item_description,
                    "quantity": 1,
                    "code": order_code,
                }
            ],
            "payments": [payment],
        },
    )


def capture_charge(settings: Settings, *, provider_charge_id: str, amount_cents: int) -> dict[str, Any]:
    if not settings.pagarme_enabled:
        now = datetime.now(timezone.utc)
        return {
            "id": provider_charge_id,
            "status": "paid",
            "amount": amount_cents,
            "paid_amount": amount_cents,
            "paid_at": now.isoformat(),
            "updated_at": now.isoformat(),
        }
    return _json_request(
        settings,
        method="POST",
        path=f"/charges/{provider_charge_id}/capture",
        body={"amount": amount_cents},
    )


def cancel_charge(settings: Settings, *, provider_charge_id: str, amount_cents: int | None = None) -> dict[str, Any]:
    if not settings.pagarme_enabled:
        now = datetime.now(timezone.utc)
        return {"id": provider_charge_id, "status": "canceled", "amount": amount_cents, "updated_at": now.isoformat()}
    body = {"amount": amount_cents} if amount_cents is not None else None
    return _json_request(settings, method="DELETE", path=f"/charges/{provider_charge_id}", body=body)


def create_recipient(settings: Settings, *, payout_profile: dict[str, Any]) -> dict[str, Any]:
    if not settings.pagarme_enabled:
        return {
            "id": f"rp_fake_{uuid4().hex[:24]}",
            "status": "active",
            "metadata": {"teacher_id": str(payout_profile["teacher_id"])},
        }

    return _json_request(
        settings,
        method="POST",
        path="/recipients",
        body={
            "name": payout_profile["legal_name"],
            "email": payout_profile.get("email"),
            "document": payout_profile["document_number"],
            "type": "individual" if payout_profile["document_type"] == "cpf" else "company",
            "default_bank_account": {
                "holder_name": payout_profile["legal_name"],
                "holder_type": "individual" if payout_profile["document_type"] == "cpf" else "company",
                "holder_document": payout_profile["document_number"],
                "bank": payout_profile["bank_code"],
                "branch_number": payout_profile["branch_number"],
                "branch_check_digit": payout_profile.get("branch_check_digit"),
                "account_number": payout_profile["account_number"],
                "account_check_digit": payout_profile.get("account_check_digit"),
                "type": "checking" if payout_profile["account_type"] == "checking" else "savings",
            },
            "metadata": {"teacher_id": str(payout_profile["teacher_id"])},
        },
    )
