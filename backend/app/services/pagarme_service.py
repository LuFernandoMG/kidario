import base64
import json
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Any
from urllib import error, parse, request
from uuid import uuid4

from app.core.config import Settings
from app.core.ssl_utils import build_ssl_context


class PagarmeIntegrationError(Exception):
    pass


def _ensure_pagarme_environment_matches_key(settings: Settings) -> None:
    secret_key = str(settings.pagarme_secret_key or "")
    base_url = str(settings.pagarme_base_url or "")
    parsed_base_url = parse.urlparse(base_url)
    if secret_key and (
        parsed_base_url.scheme != "https"
        or parsed_base_url.netloc != "api.pagar.me"
        or parsed_base_url.path.rstrip("/") != "/core/v5"
    ):
        raise PagarmeIntegrationError("Pagar.me API v5 must use https://api.pagar.me/core/v5.")


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
    _ensure_pagarme_environment_matches_key(settings)

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
            "User-Agent": "kidario-backend/1.0",
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


def create_customer(settings: Settings, *, customer: dict[str, Any]) -> dict[str, Any]:
    if not settings.pagarme_enabled:
        return {"id": f"cus_fake_{uuid4().hex[:24]}", **customer}

    return _json_request(settings, method="POST", path="/customers", body=customer)


def create_card(
    settings: Settings,
    *,
    customer_id: str,
    card_token: str,
    billing_address: dict[str, Any] | None = None,
) -> dict[str, Any]:
    if not settings.pagarme_enabled:
        return {"id": f"card_fake_{uuid4().hex[:24]}"}

    body: dict[str, Any] = {"token": card_token}
    if billing_address:
        body["billing_address"] = billing_address
    return _json_request(settings, method="POST", path=f"/customers/{customer_id}/cards", body=body)


def _split_payload(split_rules: list[PagarmeSplitRule], *, total_amount_cents: int | None = None) -> list[dict[str, Any]]:
    split_types = {split.type for split in split_rules}
    unknown_types = split_types - {"flat", "percentage"}
    if unknown_types:
        raise PagarmeIntegrationError(f"Unsupported Pagar.me split type: {', '.join(sorted(unknown_types))}")
    if len(split_types) > 1:
        raise PagarmeIntegrationError("Pagar.me split rules cannot mix flat and percentage types.")

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
            if split.amount_cents is None:
                raise PagarmeIntegrationError(f"Flat split rule for {split.split_role} requires an amount.")
            amount = int(split.amount_cents)
            if amount < 0:
                raise PagarmeIntegrationError(f"Flat split rule for {split.split_role} cannot be negative.")
            item["amount"] = amount
        else:
            if split.percentage is None:
                raise PagarmeIntegrationError(f"Percentage split rule for {split.split_role} requires a percentage.")
            percentage = Decimal(str(split.percentage)).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
            if percentage < 0 or percentage > 100:
                raise PagarmeIntegrationError(f"Percentage split rule for {split.split_role} must be between 0 and 100.")
            if percentage != percentage.to_integral_value():
                raise PagarmeIntegrationError(
                    f"Percentage split rule for {split.split_role} must be a whole percentage for Pagar.me v5."
                )
            item["amount"] = int(percentage)
        payload.append(item)

    if split_types == {"percentage"}:
        percentage_total = sum(Decimal(str(item["amount"])) for item in payload)
        if percentage_total != Decimal("100.0000"):
            raise PagarmeIntegrationError(f"Pagar.me percentage split rules must sum to 100; got {percentage_total}.")
    if split_types == {"flat"} and total_amount_cents is not None:
        amount_total = sum(int(item["amount"]) for item in payload)
        if amount_total != int(total_amount_cents):
            raise PagarmeIntegrationError(
                f"Pagar.me flat split rules must sum to the order amount; got {amount_total} for {total_amount_cents}."
            )
    return payload


def _billing_address_payload(customer: dict[str, Any]) -> dict[str, Any]:
    address = customer.get("address")
    if not isinstance(address, dict):
        return {}
    billing_address = {
        "line_1": address.get("line_1"),
        "line_2": address.get("line_2"),
        "zip_code": address.get("zip_code"),
        "city": address.get("city"),
        "state": address.get("state"),
        "country": address.get("country") or "BR",
    }
    return {key: value for key, value in billing_address.items() if value}


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
    customer_id: str | None = None,
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
        "split": _split_payload(split_rules, total_amount_cents=amount_cents),
    }
    if payment_method == "credit_card":
        credit_card: dict[str, Any] = {
            "operation_type": "auth_and_capture" if capture else "auth_only",
            "installments": installments,
        }
        if card_id:
            credit_card["card_id"] = card_id
        elif card_token:
            credit_card["card_token"] = card_token
        else:
            raise PagarmeIntegrationError("A card_token or card_id is required for credit card payments.")
        payment["credit_card"] = credit_card
    elif payment_method == "pix":
        payment["pix"] = {"expires_in": 24 * 60 * 60}
    elif payment_method == "boleto":
        payment["boleto"] = {"instructions": "Pagamento Kidario", "due_at": (datetime.now(timezone.utc) + timedelta(days=3)).date().isoformat()}
    else:
        raise PagarmeIntegrationError(f"Unsupported payment method: {payment_method}")

    body: dict[str, Any] = {
        "code": order_code,
        "closed": True,
        "items": [
            {
                "amount": amount_cents,
                "description": item_description,
                "quantity": 1,
                "code": order_code,
            }
        ],
        "payments": [payment],
    }
    if customer_id:
        body["customer_id"] = customer_id
    else:
        body["customer"] = customer
    if payment_method == "credit_card":
        billing_address = _billing_address_payload(customer)
        if billing_address:
            body["billing_address"] = billing_address

    return _json_request(
        settings,
        method="POST",
        path="/orders",
        body=body,
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


def get_charge(settings: Settings, *, provider_charge_id: str) -> dict[str, Any]:
    if not settings.pagarme_enabled:
        now = datetime.now(timezone.utc)
        return {
            "id": provider_charge_id,
            "status": "paid",
            "amount": 0,
            "paid_amount": 0,
            "paid_at": now.isoformat(),
            "updated_at": now.isoformat(),
            "last_transaction": {
                "id": f"tran_fake_{uuid4().hex[:24]}",
                "status": "captured",
                "operation_type": "capture",
            },
        }
    return _json_request(settings, method="GET", path=f"/charges/{provider_charge_id}")


def cancel_charge(settings: Settings, *, provider_charge_id: str, amount_cents: int | None = None) -> dict[str, Any]:
    if not settings.pagarme_enabled:
        now = datetime.now(timezone.utc)
        return {"id": provider_charge_id, "status": "canceled", "amount": amount_cents, "updated_at": now.isoformat()}
    body = {"amount": amount_cents} if amount_cents is not None else None
    return _json_request(settings, method="DELETE", path=f"/charges/{provider_charge_id}", body=body)


def _digits_only(value: str | None) -> str:
    return "".join(ch for ch in str(value or "") if ch.isdigit())


def _phone_number_payload(phone: str | None) -> dict[str, str]:
    digits = _digits_only(phone)
    if digits.startswith("55") and len(digits) >= 12:
        digits = digits[2:]
    if digits.startswith("0") and len(digits) >= 11:
        digits = digits[1:]
    if len(digits) < 10:
        raise PagarmeIntegrationError("Teacher phone must include DDD and number before syncing Pagar.me recipient.")
    return {
        "ddd": digits[:2],
        "number": digits[2:],
        "type": "primary",
    }


def _text_value(value: Any) -> str:
    return str(value or "").strip()


def _required_text(payout_profile: dict[str, Any], key: str, label: str) -> str:
    value = _text_value(payout_profile.get(key))
    if not value:
        raise PagarmeIntegrationError(f"Teacher payout profile is missing {label} before syncing Pagar.me recipient.")
    return value


def _address_value(payout_profile: dict[str, Any], key: str) -> str:
    return _text_value(payout_profile.get(f"address_{key}") or payout_profile.get(key))


def _register_address_payload(payout_profile: dict[str, Any]) -> dict[str, str]:
    street = _address_value(payout_profile, "street")
    district = _address_value(payout_profile, "district")
    city = _address_value(payout_profile, "city")
    state = _address_value(payout_profile, "state")
    postal_code = _digits_only(_address_value(payout_profile, "postal_code"))

    missing = []
    if not street:
        missing.append("address.street")
    if not district:
        missing.append("address.district")
    if not city:
        missing.append("address.city")
    if not state:
        missing.append("address.state")
    if len(postal_code) != 8:
        missing.append("address.postal_code")
    if missing:
        raise PagarmeIntegrationError(
            "Teacher profile is missing Pagar.me recipient address fields: " + ", ".join(missing) + "."
        )

    return {
        "street": street,
        "complementary": _address_value(payout_profile, "complement") or "S/N",
        "street_number": _address_value(payout_profile, "number") or "S/N",
        "neighborhood": district,
        "city": city,
        "state": state,
        "zip_code": postal_code,
        "reference_point": "Nao informado",
    }


def _birthdate_payload(value: Any) -> str:
    birthdate = _text_value(value)
    if not birthdate:
        raise PagarmeIntegrationError("Teacher payout profile is missing birthdate before syncing Pagar.me recipient.")
    if "/" in birthdate:
        return birthdate
    try:
        parsed = datetime.fromisoformat(birthdate[:10])
    except ValueError as exc:
        raise PagarmeIntegrationError("Teacher payout profile birthdate must be a valid date.") from exc
    return parsed.strftime("%d/%m/%Y")


def _monthly_income_payload(value: Any) -> int:
    try:
        monthly_income = int(value or 0)
    except (TypeError, ValueError) as exc:
        raise PagarmeIntegrationError(
            "Teacher payout profile monthly income must be informed in cents before syncing Pagar.me recipient."
        ) from exc
    if monthly_income <= 0:
        raise PagarmeIntegrationError(
            "Teacher payout profile monthly income must be greater than zero before syncing Pagar.me recipient."
        )
    return monthly_income


def _recipient_site_url(settings: Settings) -> str:
    return str(getattr(settings, "public_site_url", "") or "https://use.kidario.app").strip()


def create_recipient(settings: Settings, *, payout_profile: dict[str, Any]) -> dict[str, Any]:
    if not settings.pagarme_enabled:
        return {
            "id": f"rp_fake_{uuid4().hex[:24]}",
            "status": "active",
            "metadata": {"teacher_id": str(payout_profile["teacher_id"])},
        }

    is_individual = payout_profile["document_type"] == "cpf"
    register_information: dict[str, Any] = {
        "email": payout_profile.get("email"),
        "document": payout_profile["document_number"],
        "type": "individual" if is_individual else "corporation",
        "site_url": _recipient_site_url(settings),
        "phone_numbers": [_phone_number_payload(payout_profile.get("phone"))],
    }
    if is_individual:
        register_information.update(
            {
                "name": payout_profile["legal_name"],
                "birthdate": _birthdate_payload(payout_profile.get("birthdate")),
                "monthly_income": _monthly_income_payload(payout_profile.get("monthly_income_cents")),
                "professional_occupation": _required_text(
                    payout_profile,
                    "professional_occupation",
                    "professional_occupation",
                ),
                "address": _register_address_payload(payout_profile),
            }
        )
    else:
        register_information["company_name"] = payout_profile["legal_name"]
        register_information["trading_name"] = payout_profile["legal_name"]

    default_bank_account = {
        "holder_name": payout_profile["legal_name"],
        "holder_type": "individual" if is_individual else "company",
        "holder_document": payout_profile["document_number"],
        "bank": payout_profile["bank_code"],
        "branch_number": payout_profile["branch_number"],
        "account_number": payout_profile["account_number"],
        "type": "checking" if payout_profile["account_type"] == "checking" else "savings",
    }
    branch_check_digit = str(payout_profile.get("branch_check_digit") or "").strip()
    account_check_digit = str(payout_profile.get("account_check_digit") or "").strip()
    if branch_check_digit:
        default_bank_account["branch_check_digit"] = branch_check_digit
    if account_check_digit:
        default_bank_account["account_check_digit"] = account_check_digit

    return _json_request(
        settings,
        method="POST",
        path="/recipients",
        body={
            "code": str(payout_profile["teacher_id"]),
            "register_information": register_information,
            "default_bank_account": default_bank_account,
            "metadata": {"teacher_id": str(payout_profile["teacher_id"])},
        },
    )
