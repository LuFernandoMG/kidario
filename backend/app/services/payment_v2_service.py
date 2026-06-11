import json
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import AuthUser
from app.schemas.v2_payments import TeacherPayoutProfileUpsertRequest
from app.services.auth_service import AuthPasswordVerificationError, verify_supabase_password
from app.services.identity_service import (
    IdentityNotFoundError,
    IdentityPermissionError,
    require_user_role,
    resolve_teacher_id,
)
from app.services.package_v2_service import create_first_booking_for_active_package_v2
from app.services.pagarme_service import PagarmeIntegrationError, create_recipient, get_recipient


class PaymentValidationError(Exception):
    pass


class PaymentNotFoundError(Exception):
    pass


class PaymentPermissionError(Exception):
    pass


RECIPIENT_ACTIVE_STATUSES = {"active", "registered", "approved"}
RECIPIENT_REJECTED_STATUSES = {"rejected", "refused", "denied", "failed"}
RECIPIENT_DISABLED_STATUSES = {"disabled", "inactive", "blocked", "suspended", "deleted"}
NON_TERMINAL_PAYMENT_STATUSES = {"created", "pending", "processing", "authorized", "waiting_capture"}


def _require_teacher(db: Session, user: AuthUser) -> UUID:
    try:
        require_user_role(db, user.user_id, "teacher")
        return resolve_teacher_id(db, user.user_id)
    except IdentityNotFoundError as exc:
        raise PaymentPermissionError(str(exc)) from exc
    except IdentityPermissionError as exc:
        raise PaymentPermissionError("Only teacher users can manage payout profiles.") from exc


def _digits_only(value: str | None) -> str:
    return "".join(ch for ch in str(value or "") if ch.isdigit())


def _optional_bank_digit(value: str | None) -> str | None:
    cleaned = str(value or "").strip()
    return cleaned or None


def _resolve_user_email(db: Session, user: AuthUser) -> str | None:
    if user.email:
        return user.email
    return db.execute(
        text("select email from users where id = :user_id"),
        {"user_id": str(user.user_id)},
    ).scalar()


def _mask_tail(value: str | None, visible: int = 4) -> str:
    digits = _digits_only(value)
    if not digits:
        return ""
    return ("*" * max(len(digits) - visible, 0)) + digits[-visible:]


def _map_payout_profile(row: dict) -> dict:
    return {
        "id": row["id"],
        "teacher_id": row["teacher_id"],
        "legal_name": row["legal_name"],
        "document_type": row["document_type"],
        "document_number_masked": _mask_tail(row.get("document_number"), 2),
        "bank_code": row["bank_code"],
        "branch_number": row["branch_number"],
        "branch_check_digit": row["branch_check_digit"],
        "account_number_masked": _mask_tail(row.get("account_number")),
        "account_check_digit": row["account_check_digit"],
        "account_type": row["account_type"],
        "birthdate": row.get("birthdate"),
        "monthly_income_cents": row.get("monthly_income_cents"),
        "professional_occupation": row.get("professional_occupation"),
        "status": row["status"],
        "provider": row.get("provider"),
        "provider_recipient_id": row.get("provider_recipient_id"),
        "recipient_status": row.get("recipient_status"),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def _normalize_recipient_status_value(value: object) -> str | None:
    normalized = str(value or "").strip().lower()
    if normalized in RECIPIENT_ACTIVE_STATUSES:
        return "active"
    if normalized in RECIPIENT_REJECTED_STATUSES:
        return "rejected"
    if normalized in RECIPIENT_DISABLED_STATUSES:
        return "disabled"
    return None


def _recipient_status_from_provider_response(provider_response: dict) -> str:
    top_level_status = _normalize_recipient_status_value(provider_response.get("status"))
    if top_level_status:
        return top_level_status

    gateway_recipients = provider_response.get("gateway_recipients")
    if isinstance(gateway_recipients, list):
        gateway_statuses = [
            _normalize_recipient_status_value(item.get("status"))
            for item in gateway_recipients
            if isinstance(item, dict)
        ]
        if "active" in gateway_statuses:
            return "active"
        if "rejected" in gateway_statuses:
            return "rejected"
        if "disabled" in gateway_statuses:
            return "disabled"

    bank_account = provider_response.get("default_bank_account")
    bank_account_status = (
        _normalize_recipient_status_value(bank_account.get("status"))
        if isinstance(bank_account, dict)
        else None
    )
    if bank_account_status in {"rejected", "disabled"}:
        return bank_account_status

    return "pending"


def get_teacher_payout_profile_v2(db: Session, user: AuthUser) -> dict:
    teacher_id = _require_teacher(db, user)
    row = (
        db.execute(
            text(
                """
                select
                  tpp.*,
                  ppr.provider,
                  ppr.provider_recipient_id,
                  ppr.status as recipient_status
                from teacher_payout_profiles tpp
                left join payment_provider_recipients ppr
                  on ppr.teacher_id = tpp.teacher_id
                 and ppr.provider = 'pagarme'
                where tpp.teacher_id = :teacher_id
                """
            ),
            {"teacher_id": str(teacher_id)},
        )
        .mappings()
        .first()
    )
    if not row:
        raise PaymentNotFoundError("Teacher payout profile not found.")
    return _map_payout_profile(dict(row))


def upsert_teacher_payout_profile_v2(db: Session, user: AuthUser, payload: TeacherPayoutProfileUpsertRequest) -> dict:
    teacher_id = _require_teacher(db, user)
    if not payload.current_password:
        raise PaymentValidationError("Informe sua senha para salvar os dados de recebimento.")
    try:
        verify_supabase_password(
            get_settings(),
            email=_resolve_user_email(db, user),
            password=payload.current_password,
            expected_user_id=user.user_id,
        )
    except AuthPasswordVerificationError as exc:
        raise PaymentValidationError(str(exc)) from exc

    row = (
        db.execute(
            text(
                """
                insert into teacher_payout_profiles (
                  teacher_id,
                  legal_name,
                  document_type,
                  document_number,
                  bank_code,
                  branch_number,
                  branch_check_digit,
                  account_number,
                  account_check_digit,
                  account_type,
                  birthdate,
                  monthly_income_cents,
                  professional_occupation,
                  status
                )
                values (
                  :teacher_id,
                  :legal_name,
                  :document_type,
                  :document_number,
                  :bank_code,
                  :branch_number,
                  :branch_check_digit,
                  :account_number,
                  :account_check_digit,
                  :account_type,
                  :birthdate,
                  :monthly_income_cents,
                  :professional_occupation,
                  'pending'
                )
                on conflict (teacher_id) do update
                set legal_name = excluded.legal_name,
                    document_type = excluded.document_type,
                    document_number = excluded.document_number,
                    bank_code = excluded.bank_code,
                    branch_number = excluded.branch_number,
                    branch_check_digit = excluded.branch_check_digit,
                    account_number = excluded.account_number,
                    account_check_digit = excluded.account_check_digit,
                    account_type = excluded.account_type,
                    birthdate = excluded.birthdate,
                    monthly_income_cents = excluded.monthly_income_cents,
                    professional_occupation = excluded.professional_occupation,
                    status = 'pending',
                    updated_at = now()
                returning *
                """
            ),
            {
                "teacher_id": str(teacher_id),
                "legal_name": payload.legal_name.strip(),
                "document_type": payload.document_type,
                "document_number": _digits_only(payload.document_number),
                "bank_code": _digits_only(payload.bank_code) or payload.bank_code.strip(),
                "branch_number": _digits_only(payload.branch_number) or payload.branch_number.strip(),
                "branch_check_digit": _optional_bank_digit(payload.branch_check_digit),
                "account_number": _digits_only(payload.account_number) or payload.account_number.strip(),
                "account_check_digit": _optional_bank_digit(payload.account_check_digit),
                "account_type": payload.account_type,
                "birthdate": payload.birthdate,
                "monthly_income_cents": payload.monthly_income_cents,
                "professional_occupation": (
                    payload.professional_occupation.strip() if payload.professional_occupation else None
                ),
            },
        )
        .mappings()
        .first()
    )
    return _map_payout_profile(dict(row))


def sync_teacher_payment_recipient_v2(db: Session, user: AuthUser) -> dict:
    teacher_id = _require_teacher(db, user)
    row = (
        db.execute(
            text(
                """
                select
                  tpp.*,
                  u.email,
                  t.phone,
                  a.street as address_street,
                  a.number as address_number,
                  a.complement as address_complement,
                  a.district as address_district,
                  a.city as address_city,
                  a.state as address_state,
                  a.postal_code as address_postal_code,
                  a.country as address_country,
                  ppr.provider_recipient_id as existing_provider_recipient_id,
                  ppr.status as existing_recipient_status
                from teacher_payout_profiles tpp
                join teachers t on t.id = tpp.teacher_id
                join users u on u.id = t.user_id
                join addresses a on a.id = t.address_id
                left join payment_provider_recipients ppr
                  on ppr.teacher_id = tpp.teacher_id
                 and ppr.provider = 'pagarme'
                where tpp.teacher_id = :teacher_id
                """
            ),
            {"teacher_id": str(teacher_id)},
        )
        .mappings()
        .first()
    )
    if not row:
        raise PaymentValidationError("Teacher payout profile is required before syncing recipient.")
    payout_profile = dict(row)
    try:
        settings = get_settings()
        existing_provider_recipient_id = str(payout_profile.get("existing_provider_recipient_id") or "").strip()
        existing_recipient_status = str(payout_profile.get("existing_recipient_status") or "").strip().lower()
        if existing_provider_recipient_id and existing_recipient_status != "active":
            provider_response = get_recipient(settings, provider_recipient_id=existing_provider_recipient_id)
        else:
            provider_response = create_recipient(settings, payout_profile=payout_profile)
    except PagarmeIntegrationError as exc:
        raise PaymentValidationError(str(exc)) from exc

    provider_recipient_id = str(provider_response.get("id") or "").strip()
    if not provider_recipient_id:
        raise PaymentValidationError("Pagar.me recipient response did not include an id.")
    recipient_status = _recipient_status_from_provider_response(provider_response)
    db.execute(
        text(
            """
            insert into payment_provider_recipients (
              teacher_id,
              provider,
              provider_recipient_id,
              status,
              provider_response
            )
            values (
              :teacher_id,
              'pagarme',
              :provider_recipient_id,
              :status,
              cast(:provider_response as jsonb)
            )
            on conflict (teacher_id, provider) do update
            set provider_recipient_id = excluded.provider_recipient_id,
                status = excluded.status,
                provider_response = excluded.provider_response,
                updated_at = now()
            """
        ),
        {
            "teacher_id": str(teacher_id),
            "provider_recipient_id": provider_recipient_id,
            "status": recipient_status,
            "provider_response": json.dumps(provider_response),
        },
    )
    db.execute(
        text(
            """
            update teacher_payout_profiles
            set status = :status,
                provider_response = cast(:provider_response as jsonb),
                updated_at = now()
            where teacher_id = :teacher_id
            """
        ),
        {"teacher_id": str(teacher_id), "status": recipient_status, "provider_response": json.dumps(provider_response)},
    )
    return {
        "status": "ok",
        "teacher_id": teacher_id,
        "provider": "pagarme",
        "provider_recipient_id": provider_recipient_id,
        "recipient_status": recipient_status,
    }


def _event_type(payload: dict) -> str:
    return str(payload.get("type") or payload.get("event") or payload.get("event_type") or "").strip()


def _event_data(payload: dict) -> dict:
    data = payload.get("data")
    return data if isinstance(data, dict) else payload


def _nested_id(data: dict, key: str) -> str | None:
    nested = data.get(key)
    if isinstance(nested, dict) and nested.get("id"):
        return str(nested["id"])
    return None


def _first_event_charge(data: dict) -> dict:
    charges = data.get("charges")
    if isinstance(charges, list) and charges:
        charge = charges[0]
        return charge if isinstance(charge, dict) else {}
    return {}


def _provider_order_id_from_event(event_type: str, data: dict) -> str | None:
    if nested_order_id := _nested_id(data, "order"):
        return nested_order_id
    if "order" in event_type.lower() and data.get("id"):
        return str(data["id"])
    return None


def _provider_charge_id_from_event(event_type: str, data: dict) -> str | None:
    if nested_charge_id := _nested_id(data, "charge"):
        return nested_charge_id
    if "charge" in event_type.lower() and data.get("id"):
        return str(data["id"])
    charge = _first_event_charge(data)
    if charge.get("id"):
        return str(charge["id"])
    return None


def _event_paid_amount_cents(data: dict, fallback_amount_cents: object) -> int | None:
    charge = _first_event_charge(data)
    for source in (data, charge):
        if not isinstance(source, dict):
            continue
        raw_amount = source.get("paid_amount") or source.get("amount")
        if raw_amount is None:
            continue
        try:
            amount = int(raw_amount)
        except (TypeError, ValueError):
            continue
        return amount if amount > 0 else None
    try:
        fallback = int(fallback_amount_cents or 0)
    except (TypeError, ValueError):
        return None
    return fallback if fallback > 0 else None


def _merge_payment_status(current_status: object, incoming_status: str) -> str:
    current = str(current_status or "").strip().lower()
    incoming = str(incoming_status or "").strip().lower() or "pending"
    if current == "paid" and incoming in NON_TERMINAL_PAYMENT_STATUSES | {"payment_failed", "failed", "canceled", "expired"}:
        return "paid"
    if current in {"refunded", "chargedback"} and incoming in NON_TERMINAL_PAYMENT_STATUSES | {"payment_failed", "failed", "canceled", "expired"}:
        return current
    if current == "canceled" and incoming in NON_TERMINAL_PAYMENT_STATUSES:
        return current
    return incoming


def _normalize_status_from_event(event_type: str, data: dict) -> tuple[str, str]:
    normalized_event = event_type.lower()
    raw_status = str(data.get("status") or "").lower()
    if "paid" in normalized_event or raw_status == "paid":
        return "paid", "paid"
    if "authorized" in normalized_event or raw_status in {"authorized", "waiting_capture"}:
        return "authorized", "authorized"
    if "failed" in normalized_event or "refused" in normalized_event or raw_status in {"failed", "refused", "not_authorized"}:
        return "payment_failed", "payment_failed"
    if "canceled" in normalized_event or raw_status == "canceled":
        return "canceled", "canceled"
    if "expired" in normalized_event or raw_status == "expired":
        return "expired", "expired"
    if "refunded" in normalized_event or raw_status == "refunded":
        return "refunded", "refunded"
    return "pending", "pending"


def _recipient_id_from_event(event_type: str, data: dict) -> str | None:
    if nested_recipient_id := _nested_id(data, "recipient"):
        return nested_recipient_id
    raw_id = str(data.get("id") or "").strip()
    if raw_id.startswith(("rp_", "re_")):
        return raw_id
    if "recipient" in event_type.lower() and raw_id:
        return raw_id
    return None


def _teacher_id_from_recipient_event(data: dict) -> str | None:
    for source in (data.get("metadata"), data):
        if not isinstance(source, dict):
            continue
        raw_teacher_id = str(source.get("teacher_id") or source.get("code") or "").strip()
        if not raw_teacher_id:
            continue
        try:
            return str(UUID(raw_teacher_id))
        except ValueError:
            continue
    return None


def _sync_recipient_status_from_webhook(
    db: Session,
    *,
    provider_recipient_id: str,
    provider_response: dict,
) -> bool:
    recipient_status = _recipient_status_from_provider_response(provider_response)
    existing = (
        db.execute(
            text(
                """
                select teacher_id, status
                from payment_provider_recipients
                where provider = 'pagarme'
                  and provider_recipient_id = :provider_recipient_id
                limit 1
                """
            ),
            {"provider_recipient_id": provider_recipient_id},
        )
        .mappings()
        .first()
    )
    teacher_id = str(existing["teacher_id"]) if existing else _teacher_id_from_recipient_event(provider_response)
    if not teacher_id:
        return False
    if existing and str(existing["status"] or "").lower() == "active" and recipient_status == "pending":
        recipient_status = "active"

    db.execute(
        text(
            """
            insert into payment_provider_recipients (
              teacher_id,
              provider,
              provider_recipient_id,
              status,
              provider_response
            )
            values (
              :teacher_id,
              'pagarme',
              :provider_recipient_id,
              :status,
              cast(:provider_response as jsonb)
            )
            on conflict (teacher_id, provider) do update
            set provider_recipient_id = excluded.provider_recipient_id,
                status = excluded.status,
                provider_response = excluded.provider_response,
                updated_at = now()
            """
        ),
        {
            "teacher_id": teacher_id,
            "provider_recipient_id": provider_recipient_id,
            "status": recipient_status,
            "provider_response": json.dumps(provider_response),
        },
    )
    db.execute(
        text(
            """
            update teacher_payout_profiles
            set status = :status,
                provider_response = cast(:provider_response as jsonb),
                updated_at = now()
            where teacher_id = :teacher_id
            """
        ),
        {
            "teacher_id": teacher_id,
            "status": recipient_status,
            "provider_response": json.dumps(provider_response),
        },
    )
    return True


def _load_payment_charge_for_webhook(
    db: Session,
    *,
    payment_order_id: UUID | str,
    provider_charge_id: str | None,
) -> dict | None:
    if provider_charge_id:
        row = (
            db.execute(
                text(
                    """
                    select *
                    from payment_charges
                    where payment_order_id = :payment_order_id
                      and provider_charge_id = :provider_charge_id
                    limit 1
                    """
                ),
                {"payment_order_id": str(payment_order_id), "provider_charge_id": provider_charge_id},
            )
            .mappings()
            .first()
        )
        if row:
            return dict(row)

    row = (
        db.execute(
            text(
                """
                select *
                from payment_charges
                where payment_order_id = :payment_order_id
                order by created_at desc
                limit 1
                """
            ),
            {"payment_order_id": str(payment_order_id)},
        )
        .mappings()
        .first()
    )
    return dict(row) if row else None


def process_pagarme_webhook_v2(db: Session, payload: dict) -> dict:
    if not isinstance(payload, dict):
        raise PaymentValidationError("Webhook payload must be a JSON object.")

    event_type = _event_type(payload)
    provider_event_id = str(payload.get("id") or payload.get("event_id") or "").strip() or None
    data = _event_data(payload)
    provider_order_id = _provider_order_id_from_event(event_type, data)
    provider_charge_id = _provider_charge_id_from_event(event_type, data)
    provider_recipient_id = _recipient_id_from_event(event_type, data)

    event_row = (
        db.execute(
            text(
                """
                insert into payment_webhook_events (
                  provider,
                  event_type,
                  provider_event_id,
                  provider_order_id,
                  provider_charge_id,
                  payload
                )
                values (
                  'pagarme',
                  :event_type,
                  :provider_event_id,
                  :provider_order_id,
                  :provider_charge_id,
                  cast(:payload as jsonb)
                )
                on conflict (provider, provider_event_id)
                where provider_event_id is not null
                do nothing
                returning id
                """
            ),
            {
                "event_type": event_type or "unknown",
                "provider_event_id": provider_event_id,
                "provider_order_id": provider_order_id,
                "provider_charge_id": provider_charge_id,
                "payload": json.dumps(payload),
            },
        )
        .mappings()
        .first()
    )
    if not event_row and provider_event_id:
        return {"status": "ignored", "event_id": None}

    if provider_recipient_id and not provider_order_id and not provider_charge_id:
        synced = _sync_recipient_status_from_webhook(
            db,
            provider_recipient_id=provider_recipient_id,
            provider_response=data,
        )
        db.execute(
            text(
                """
                update payment_webhook_events
                set processing_status = :processing_status,
                    processed_at = now(),
                    error_message = :error_message
                where id = :event_id
                """
            ),
            {
                "event_id": str(event_row["id"]) if event_row else None,
                "processing_status": "processed" if synced else "ignored",
                "error_message": None if synced else "Recipient not found",
            },
        )
        return {"status": "ok" if synced else "ignored", "event_id": event_row["id"] if event_row else None}

    payment_order = None
    if provider_order_id:
        payment_order = (
            db.execute(
                text("select * from payment_orders where provider_order_id = :provider_order_id limit 1"),
                {"provider_order_id": provider_order_id},
            )
            .mappings()
            .first()
        )
    if not payment_order and provider_charge_id:
        payment_order = (
            db.execute(
                text(
                    """
                    select po.*
                    from payment_orders po
                    join payment_charges pc on pc.payment_order_id = po.id
                    where pc.provider_charge_id = :provider_charge_id
                    limit 1
                    """
                ),
                {"provider_charge_id": provider_charge_id},
            )
            .mappings()
            .first()
        )
    if not payment_order:
        db.execute(
            text(
                """
                update payment_webhook_events
                set processing_status = 'ignored',
                    processed_at = now(),
                    error_message = 'Payment order not found'
                where id = :event_id
                """
            ),
            {"event_id": str(event_row["id"]) if event_row else None},
        )
        return {"status": "ignored", "event_id": event_row["id"] if event_row else None}

    payment_charge = _load_payment_charge_for_webhook(
        db,
        payment_order_id=payment_order["id"],
        provider_charge_id=provider_charge_id,
    )
    incoming_order_status, incoming_charge_status = _normalize_status_from_event(event_type, data)
    order_status = _merge_payment_status(payment_order["status"], incoming_order_status)
    charge_status = _merge_payment_status(payment_charge.get("status") if payment_charge else None, incoming_charge_status)
    paid_amount_cents = _event_paid_amount_cents(data, payment_order["amount_cents"]) if charge_status == "paid" else None
    db.execute(
        text(
            """
            update payment_orders
            set status = :status,
                paid_at = case when :status = 'paid' then coalesce(paid_at, now()) else paid_at end,
                expires_at = case when :status = 'expired' then coalesce(expires_at, now()) else expires_at end,
                provider_response = cast(:provider_response as jsonb),
                updated_at = now()
            where id = :payment_order_id
            """
        ),
        {
            "payment_order_id": str(payment_order["id"]),
            "status": order_status,
            "provider_response": json.dumps(payload),
        },
    )
    db.execute(
        text(
            """
            update payment_charges
            set status = :status,
                provider_charge_id = coalesce(:provider_charge_id, provider_charge_id),
                paid_amount_cents = coalesce(:paid_amount_cents, paid_amount_cents),
                paid_at = case when :status = 'paid' then coalesce(paid_at, now()) else paid_at end,
                failed_at = case when :status in ('failed', 'payment_failed') then coalesce(failed_at, now()) else failed_at end,
                canceled_at = case when :status = 'canceled' then coalesce(canceled_at, now()) else canceled_at end,
                provider_response = cast(:provider_response as jsonb),
                updated_at = now()
            where payment_order_id = :payment_order_id
            """
        ),
        {
            "payment_order_id": str(payment_order["id"]),
            "status": charge_status,
            "provider_charge_id": provider_charge_id,
            "paid_amount_cents": paid_amount_cents,
            "provider_response": json.dumps(payload),
        },
    )
    if payment_order["booking_id"]:
        booking_status = "confirmada" if order_status == "paid" else "pendente"
        payment_flow_status = {
            "paid": "paid",
            "payment_failed": "failed",
            "expired": "expired",
            "refunded": "refunded",
            "authorized": "authorized",
        }.get(order_status, "awaiting_payment")
        db.execute(
            text(
                """
                update bookings
                set status = :booking_status,
                    confirmed_at = case when :booking_status = 'confirmada' then coalesce(confirmed_at, now()) else confirmed_at end,
                    payment_flow_status = :payment_flow_status,
                    updated_at = now()
                where id = :booking_id
                """
            ),
            {
                "booking_id": str(payment_order["booking_id"]),
                "booking_status": booking_status,
                "payment_flow_status": payment_flow_status,
            },
        )
    if payment_order["package_id"] and order_status == "paid":
        db.execute(
            text(
                """
                update booking_packages
                set status = 'active',
                    valid_from = coalesce(valid_from, now()),
                    updated_at = now()
                where id = :package_id
                """
            ),
            {"package_id": str(payment_order["package_id"])},
        )
        create_first_booking_for_active_package_v2(db, payment_order["package_id"])
    db.execute(
        text(
            """
            update payment_webhook_events
            set processing_status = 'processed',
                processed_at = now(),
                payment_order_id = :payment_order_id
            where id = :event_id
            """
        ),
        {"event_id": str(event_row["id"]) if event_row else None, "payment_order_id": str(payment_order["id"])},
    )
    return {"status": "ok", "event_id": event_row["id"] if event_row else None}
