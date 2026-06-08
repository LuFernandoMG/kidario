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
from app.services.pagarme_service import PagarmeIntegrationError, create_recipient


class PaymentValidationError(Exception):
    pass


class PaymentNotFoundError(Exception):
    pass


class PaymentPermissionError(Exception):
    pass


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
                  a.country as address_country
                from teacher_payout_profiles tpp
                join teachers t on t.id = tpp.teacher_id
                join users u on u.id = t.user_id
                join addresses a on a.id = t.address_id
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
        provider_response = create_recipient(get_settings(), payout_profile=payout_profile)
    except PagarmeIntegrationError as exc:
        raise PaymentValidationError(str(exc)) from exc

    provider_recipient_id = str(provider_response.get("id") or "").strip()
    if not provider_recipient_id:
        raise PaymentValidationError("Pagar.me recipient response did not include an id.")
    recipient_status = "active" if str(provider_response.get("status") or "").lower() in {"active", "registered"} else "pending"
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


def process_pagarme_webhook_v2(db: Session, payload: dict) -> dict:
    if not isinstance(payload, dict):
        raise PaymentValidationError("Webhook payload must be a JSON object.")

    event_type = _event_type(payload)
    provider_event_id = str(payload.get("id") or payload.get("event_id") or "").strip() or None
    data = _event_data(payload)
    provider_order_id = _nested_id(data, "order") or (str(data.get("id")) if "order" in event_type.lower() else None)
    provider_charge_id = _nested_id(data, "charge") or (str(data.get("id")) if "charge" in event_type.lower() else None)

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

    order_status, charge_status = _normalize_status_from_event(event_type, data)
    db.execute(
        text(
            """
            update payment_orders
            set status = :status,
                paid_at = case when :status = 'paid' then coalesce(paid_at, now()) else paid_at end,
                expires_at = case when :status = 'expired' then coalesce(expires_at, now()) else expires_at end,
                updated_at = now()
            where id = :payment_order_id
            """
        ),
        {"payment_order_id": str(payment_order["id"]), "status": order_status},
    )
    db.execute(
        text(
            """
            update payment_charges
            set status = :status,
                paid_at = case when :status = 'paid' then coalesce(paid_at, now()) else paid_at end,
                failed_at = case when :status in ('failed', 'payment_failed') then coalesce(failed_at, now()) else failed_at end,
                canceled_at = case when :status = 'canceled' then coalesce(canceled_at, now()) else canceled_at end,
                updated_at = now()
            where payment_order_id = :payment_order_id
            """
        ),
        {"payment_order_id": str(payment_order["id"]), "status": charge_status},
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
