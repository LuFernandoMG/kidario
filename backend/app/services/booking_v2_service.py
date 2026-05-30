import json
from datetime import date, datetime, time, timedelta
from uuid import UUID, uuid4
from zoneinfo import ZoneInfo

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import AuthUser
from app.schemas.v2_bookings import (
    BookingCancelRequest,
    BookingCompleteRequest,
    BookingCreateRequest,
    BookingDecisionRequest,
    BookingRescheduleRequest,
)
from app.services.identity_service import (
    IdentityNotFoundError,
    IdentityPermissionError,
    get_actor_participant_ids,
    require_user_role,
    resolve_parent_id,
    resolve_teacher_id,
)
from app.services.storage_url_service import resolve_teacher_profile_photo_url
from app.services.teacher_activity_planner_service import (
    TeacherActivityPlanInput,
    get_cached_teacher_activity_plan_for_booking,
    get_or_create_teacher_activity_plan_for_booking,
)
from app.services.pagarme_service import (
    PagarmeIntegrationError,
    PagarmeSplitRule,
    cancel_charge,
    capture_charge,
    create_order,
)


class BookingValidationError(Exception):
    pass


class BookingConflictError(Exception):
    pass


class BookingNotFoundError(Exception):
    pass


class BookingPermissionError(Exception):
    pass


MIN_BOOKING_LEAD_MINUTES = 60
LOCAL_TZ = ZoneInfo("America/Sao_Paulo")


def _require_parent(db: Session, user: AuthUser) -> UUID:
    try:
        require_user_role(db, user.user_id, "parent")
        return resolve_parent_id(db, user.user_id)
    except IdentityNotFoundError as exc:
        raise BookingPermissionError(str(exc)) from exc
    except IdentityPermissionError as exc:
        raise BookingPermissionError("Only parent users can perform this action.") from exc


def _require_teacher(db: Session, user: AuthUser) -> UUID:
    try:
        require_user_role(db, user.user_id, "teacher")
        return resolve_teacher_id(db, user.user_id)
    except IdentityNotFoundError as exc:
        raise BookingPermissionError(str(exc)) from exc
    except IdentityPermissionError as exc:
        raise BookingPermissionError("Only teacher users can perform this action.") from exc


def _normalize_starts_at(starts_at: datetime) -> datetime:
    if starts_at.tzinfo is None:
        return starts_at.replace(tzinfo=LOCAL_TZ)
    return starts_at.astimezone(LOCAL_TZ)


def _ensure_minimum_booking_lead_time(starts_at: datetime) -> None:
    if _normalize_starts_at(starts_at) < datetime.now(LOCAL_TZ) + timedelta(minutes=MIN_BOOKING_LEAD_MINUTES):
        raise BookingValidationError(
            f"A aula deve ser agendada com pelo menos {MIN_BOOKING_LEAD_MINUTES} minutos de antecedência."
        )


def _can_teacher_complete_booking(*, booking_status: str, starts_at: datetime, duration_minutes: int) -> bool:
    if booking_status == "concluida":
        return True
    if booking_status != "confirmada":
        return False
    lesson_end = _normalize_starts_at(starts_at) + timedelta(minutes=int(duration_minutes or 0))
    return lesson_end <= datetime.now(LOCAL_TZ)


def _normalize_objectives(raw_objectives: object) -> list[dict]:
    if raw_objectives is None:
        return []
    parsed_raw = raw_objectives
    if isinstance(raw_objectives, str):
        normalized = raw_objectives.strip()
        if not normalized:
            return []
        try:
            parsed_raw = json.loads(normalized)
        except json.JSONDecodeError:
            parsed_raw = [normalized]
    if not isinstance(parsed_raw, (list, tuple)):
        parsed_raw = [parsed_raw]

    normalized_objectives: list[dict] = []
    for raw_item in parsed_raw:
        if isinstance(raw_item, str):
            objective_text = raw_item.strip()
            if objective_text:
                normalized_objectives.append(
                    {"objective": objective_text, "achieved": False, "fullfilment_level": 0}
                )
            continue
        if not isinstance(raw_item, dict):
            continue
        objective_text = str(raw_item.get("objective", "")).strip()
        if not objective_text:
            continue
        level_raw = raw_item.get("fullfilment_level", raw_item.get("fulfilment_level"))
        level = level_raw if isinstance(level_raw, int) and 0 <= level_raw <= 5 else 0
        normalized_objectives.append(
            {
                "objective": objective_text,
                "achieved": bool(raw_item.get("achieved", False)),
                "fullfilment_level": level,
            }
        )
    return normalized_objectives


def _parse_focus_points(raw_focus_points: str | None) -> list[str]:
    if not raw_focus_points:
        return []
    points = [raw_focus_points.strip()]
    for separator in ["\n", ";", ",", "•"]:
        next_points: list[str] = []
        for point in points:
            next_points.extend(point.split(separator))
        points = next_points
    return [point.strip(" -\t") for point in points if point.strip(" -\t")]


def _resolve_child_id(db: Session, parent_id: UUID, child_id: UUID) -> UUID:
    row = (
        db.execute(
            text(
                """
                select id
                from children
                where id = :child_id and parent_id = :parent_id
                """
            ),
            {"child_id": str(child_id), "parent_id": str(parent_id)},
        )
        .mappings()
        .first()
    )
    if not row:
        raise BookingValidationError("child_id does not belong to the authenticated parent.")
    return UUID(str(row["id"]))


def _ensure_teacher_exists(db: Session, teacher_id: UUID) -> dict:
    row = (
        db.execute(
            text(
                """
                select id, user_id, modality, hourly_rate_cents, coalesce(lesson_duration_minutes, 60) as lesson_duration_minutes
                from teachers
                where id = :teacher_id
                """
            ),
            {"teacher_id": str(teacher_id)},
        )
        .mappings()
        .first()
    )
    if not row:
        raise BookingValidationError("Teacher profile not found.")
    return dict(row)


def _ensure_teacher_supports_modality(teacher: dict, requested_modality: str) -> None:
    normalized_modality = str(teacher.get("modality") or "online").strip().lower()
    if normalized_modality in ("ambos", "hibrido"):
        return
    if normalized_modality != requested_modality:
        raise BookingValidationError("Selected modality is not offered by this teacher.")


def _ensure_slot_is_available(
    db: Session,
    teacher_id: UUID,
    starts_at: datetime,
    excluding_booking_id: UUID | None = None,
) -> None:
    filters = """
        teacher_id = :teacher_id
        and starts_at = :starts_at
        and status in ('pendente', 'confirmada')
        and coalesce(teacher_decision_status, 'pending') <> 'rejected'
    """
    params: dict[str, object] = {"teacher_id": str(teacher_id), "starts_at": _normalize_starts_at(starts_at)}
    if excluding_booking_id:
        filters += " and id <> :excluding_booking_id"
        params["excluding_booking_id"] = str(excluding_booking_id)
    exists = db.execute(text(f"select exists(select 1 from bookings where {filters})"), params).scalar_one()
    if exists:
        raise BookingConflictError("Selected slot is no longer available.")


def _resolve_active_package_for_booking(
    db: Session,
    package_id: UUID,
    parent_id: UUID,
    teacher_id: UUID,
    child_id: UUID,
) -> dict:
    row = (
        db.execute(
            text(
                """
                select id, total_sessions, status
                from booking_packages
                where id = :package_id
                  and parent_id = :parent_id
                  and teacher_id = :teacher_id
                  and child_id = :child_id
                """
            ),
            {
                "package_id": str(package_id),
                "parent_id": str(parent_id),
                "teacher_id": str(teacher_id),
                "child_id": str(child_id),
            },
        )
        .mappings()
        .first()
    )
    if not row:
        raise BookingValidationError("Package purchase does not match this parent, teacher and child.")
    package = dict(row)
    if package["status"] != "active":
        raise BookingValidationError("Package purchase must be active before booking a class.")

    booked_sessions = db.execute(
        text(
            """
            select count(*)
            from bookings
            where package_id = :package_id
              and status <> 'cancelada'
            """
        ),
        {"package_id": str(package_id)},
    ).scalar_one()
    if int(booked_sessions) >= int(package["total_sessions"]):
        raise BookingValidationError("Package purchase has no remaining sessions.")
    return package


def _load_payment_order_for_booking(db: Session, booking_id: UUID | str) -> dict | None:
    row = (
        db.execute(
            text(
                """
                select
                  id,
                  parent_id,
                  booking_id,
                  package_id,
                  provider,
                  provider_order_id,
                  provider_order_code,
                  requested_payment_method,
                  amount_cents,
                  currency,
                  status,
                  authorized_at,
                  paid_at,
                  expires_at,
                  created_at,
                  updated_at
                from payment_orders
                where booking_id = :booking_id
                order by created_at desc
                limit 1
                """
            ),
            {"booking_id": str(booking_id)},
        )
        .mappings()
        .first()
    )
    return _map_payment_order(db, dict(row)) if row else None


def _map_payment_order(db: Session, row: dict) -> dict:
    charges = (
        db.execute(
            text(
                """
                select
                  id,
                  payment_order_id,
                  provider,
                  provider_charge_id,
                  provider_transaction_id,
                  payment_method,
                  status,
                  amount_cents,
                  paid_amount_cents,
                  installments,
                  pix_qr_code_url,
                  boleto_url,
                  card_brand,
                  card_last_four,
                  card_holder_name,
                  authorization_code,
                  authorized_at,
                  captured_at,
                  expires_at,
                  payment_url,
                  boleto_barcode,
                  boleto_line,
                  paid_at,
                  failed_at,
                  canceled_at,
                  refunded_at,
                  created_at,
                  updated_at
                from payment_charges
                where payment_order_id = :payment_order_id
                order by created_at asc
                """
            ),
            {"payment_order_id": str(row["id"])},
        )
        .mappings()
        .all()
    )
    return {
        "id": row["id"],
        "parent_id": row["parent_id"],
        "booking_id": row["booking_id"],
        "package_id": row["package_id"],
        "provider": row["provider"],
        "provider_order_id": row["provider_order_id"],
        "provider_order_code": row["provider_order_code"],
        "requested_payment_method": row.get("requested_payment_method"),
        "amount_cents": int(row["amount_cents"] or 0),
        "currency": row["currency"] or "BRL",
        "status": row["status"],
        "authorized_at": row.get("authorized_at"),
        "paid_at": row.get("paid_at"),
        "expires_at": row.get("expires_at"),
        "charges": [dict(charge) for charge in charges],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def _load_booking_row(db: Session, booking_id: UUID) -> dict:
    row = (
        db.execute(
            text(
                """
                select
                  b.id,
                  b.parent_id,
                  b.child_id,
                  b.teacher_id,
                  b.package_id,
                  b.starts_at,
                  b.duration_minutes,
                  b.modality,
                  b.status,
                  coalesce(b.teacher_decision_status, 'pending') as teacher_decision_status,
                  b.teacher_decision_reason,
                  b.teacher_decision_at,
                  coalesce(b.payment_flow_status, 'not_started') as payment_flow_status,
                  b.cancellation_reason,
                  b.confirmed_at,
                  b.completed_at,
                  b.canceled_at,
                  b.created_at,
                  b.updated_at,
                  c.name as child_name,
                  coalesce(nullif(trim(concat_ws(' ', tu.first_name, tu.last_name)), ''), 'Professora Kidario') as teacher_name,
                  t.profile_photo_file_name as teacher_profile_photo_file_name,
                  coalesce(nullif(trim(concat_ws(' ', pu.first_name, pu.last_name)), ''), 'Responsavel Kidario') as parent_name
                from bookings b
                join children c on c.id = b.child_id
                join teachers t on t.id = b.teacher_id
                join users tu on tu.id = t.user_id
                join parents p on p.id = b.parent_id
                join users pu on pu.id = p.user_id
                where b.id = :booking_id
                """
            ),
            {"booking_id": str(booking_id)},
        )
        .mappings()
        .first()
    )
    if not row:
        raise BookingNotFoundError("Booking not found.")
    return dict(row)


def _load_latest_follow_up(db: Session, booking_id: UUID | str) -> dict | None:
    row = (
        db.execute(
            text(
                """
                select updated_at, summary, next_steps, objectives, next_objectives, tags, attention_points
                from booking_follow_ups
                where booking_id = :booking_id
                """
            ),
            {"booking_id": str(booking_id)},
        )
        .mappings()
        .first()
    )
    if not row:
        return None
    return {
        "updated_at": row["updated_at"],
        "summary": row["summary"],
        "next_steps": row["next_steps"],
        "objectives": _normalize_objectives(row.get("objectives")),
        "next_objectives": _normalize_objectives(row.get("next_objectives")),
        "tags": list(row["tags"] or []),
        "attention_points": list(row["attention_points"] or []),
    }


def _build_booking(db: Session, row: dict, *, actor_parent_id: UUID | None, actor_teacher_id: UUID | None) -> dict:
    settings = get_settings()
    review_exists = db.execute(
        text("select exists(select 1 from booking_reviews where booking_id = :booking_id)"),
        {"booking_id": str(row["id"])},
    ).scalar_one()
    is_parent_owner = actor_parent_id is not None and str(row["parent_id"]) == str(actor_parent_id)
    is_teacher_owner = actor_teacher_id is not None and str(row["teacher_id"]) == str(actor_teacher_id)
    can_reschedule_or_cancel = row["status"] in ("pendente", "confirmada")

    return {
        "id": row["id"],
        "parent_id": row["parent_id"],
        "child_id": row["child_id"],
        "teacher_id": row["teacher_id"],
        "package_id": row["package_id"],
        "starts_at": row["starts_at"],
        "duration_minutes": row["duration_minutes"],
        "modality": row["modality"],
        "status": row["status"],
        "teacher_decision_status": row.get("teacher_decision_status") or "pending",
        "teacher_decision_reason": row.get("teacher_decision_reason"),
        "teacher_decision_at": row.get("teacher_decision_at"),
        "payment_flow_status": row.get("payment_flow_status") or "not_started",
        "cancellation_reason": row["cancellation_reason"],
        "confirmed_at": row["confirmed_at"],
        "completed_at": row["completed_at"],
        "canceled_at": row["canceled_at"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
        "child": {"id": row["child_id"], "name": row["child_name"]},
        "teacher": {
            "id": row["teacher_id"],
            "display_name": row["teacher_name"],
            "profile_photo_url": resolve_teacher_profile_photo_url(
                settings,
                row["teacher_profile_photo_file_name"],
            ),
        },
        "parent": {"id": row["parent_id"], "display_name": row["parent_name"]},
        "payment_order": _load_payment_order_for_booking(db, row["id"]),
        "latest_follow_up": _load_latest_follow_up(db, row["id"]),
        "actions": {
            "can_reschedule": bool(is_parent_owner and can_reschedule_or_cancel),
            "can_cancel": bool(is_parent_owner and can_reschedule_or_cancel),
            "can_complete": bool(
                is_teacher_owner
                and _can_teacher_complete_booking(
                    booking_status=str(row["status"]),
                    starts_at=row["starts_at"],
                    duration_minutes=int(row["duration_minutes"]),
                )
            ),
            "can_review": bool(is_parent_owner and row["status"] == "concluida" and not review_exists),
        },
    }


def get_booking_v2(db: Session, user: AuthUser, booking_id: UUID) -> dict:
    row = _load_booking_row(db, booking_id)
    try:
        actor_parent_id, actor_teacher_id = get_actor_participant_ids(db, user.user_id)
    except IdentityNotFoundError as exc:
        raise BookingPermissionError("You do not have access to this booking.") from exc
    if str(row["parent_id"]) != str(actor_parent_id) and str(row["teacher_id"]) != str(actor_teacher_id):
        raise BookingPermissionError("You do not have access to this booking.")
    return _build_booking(db, row, actor_parent_id=actor_parent_id, actor_teacher_id=actor_teacher_id)


def _list_bookings(
    db: Session,
    *,
    where_clauses: list[str],
    params: dict[str, object],
    actor_parent_id: UUID | None,
    actor_teacher_id: UUID | None,
    tab: str,
    limit: int,
    offset: int,
) -> dict:
    if tab == "past":
        where_clauses.append("b.starts_at < now()")
        order_direction = "desc"
    else:
        where_clauses.append("b.starts_at >= now()")
        order_direction = "asc"
    params["limit"] = limit
    params["offset"] = offset

    rows = (
        db.execute(
            text(
                f"""
                select
                  b.id,
                  b.parent_id,
                  b.child_id,
                  b.teacher_id,
                  b.package_id,
                  b.starts_at,
                  b.duration_minutes,
                  b.modality,
                  b.status,
                  coalesce(b.teacher_decision_status, 'pending') as teacher_decision_status,
                  b.teacher_decision_reason,
                  b.teacher_decision_at,
                  coalesce(b.payment_flow_status, 'not_started') as payment_flow_status,
                  b.cancellation_reason,
                  b.confirmed_at,
                  b.completed_at,
                  b.canceled_at,
                  b.created_at,
                  b.updated_at,
                  c.name as child_name,
                  coalesce(nullif(trim(concat_ws(' ', tu.first_name, tu.last_name)), ''), 'Professora Kidario') as teacher_name,
                  t.profile_photo_file_name as teacher_profile_photo_file_name,
                  coalesce(nullif(trim(concat_ws(' ', pu.first_name, pu.last_name)), ''), 'Responsavel Kidario') as parent_name
                from bookings b
                join children c on c.id = b.child_id
                join teachers t on t.id = b.teacher_id
                join users tu on tu.id = t.user_id
                join parents p on p.id = b.parent_id
                join users pu on pu.id = p.user_id
                where {' and '.join(where_clauses)}
                order by b.starts_at {order_direction}
                limit :limit
                offset :offset
                """
            ),
            params,
        )
        .mappings()
        .all()
    )
    return {
        "bookings": [
            _build_booking(db, dict(row), actor_parent_id=actor_parent_id, actor_teacher_id=actor_teacher_id)
            for row in rows
        ]
    }


def list_parent_bookings_v2(
    db: Session,
    user: AuthUser,
    *,
    tab: str = "upcoming",
    status: str | None = None,
    child_id: UUID | None = None,
    limit: int = 50,
    offset: int = 0,
) -> dict:
    parent_id = _require_parent(db, user)
    where = ["b.parent_id = :parent_id"]
    params: dict[str, object] = {"parent_id": str(parent_id)}
    if status:
        where.append("b.status = :status")
        params["status"] = status
    if child_id:
        where.append("b.child_id = :child_id")
        params["child_id"] = str(child_id)
    return _list_bookings(
        db,
        where_clauses=where,
        params=params,
        actor_parent_id=parent_id,
        actor_teacher_id=None,
        tab=tab,
        limit=limit,
        offset=offset,
    )


def list_teacher_bookings_v2(
    db: Session,
    user: AuthUser,
    *,
    tab: str = "upcoming",
    status: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> dict:
    teacher_id = _require_teacher(db, user)
    where = ["b.teacher_id = :teacher_id"]
    params: dict[str, object] = {"teacher_id": str(teacher_id)}
    if status:
        where.append("b.status = :status")
        params["status"] = status
    return _list_bookings(
        db,
        where_clauses=where,
        params=params,
        actor_parent_id=None,
        actor_teacher_id=teacher_id,
        tab=tab,
        limit=limit,
        offset=offset,
    )


def _digits_only(value: str | None) -> str:
    return "".join(ch for ch in str(value or "") if ch.isdigit())


def _payment_provider() -> str:
    return "pagarme" if get_settings().pagarme_enabled else "internal"


def _normalize_payment_order_status(raw_status: str | None, payment_method: str | None = None) -> str:
    status = str(raw_status or "").strip().lower()
    if status in {"paid", "authorized", "pending", "canceled", "refunded", "partially_refunded"}:
        return status
    if status in {"failed", "payment_failed", "refused", "not_authorized"}:
        return "payment_failed"
    if status in {"expired"}:
        return "expired"
    if payment_method == "credit_card" and status in {"processing", "waiting_capture"}:
        return "authorized"
    return "pending"


def _normalize_payment_charge_status(raw_status: str | None, payment_method: str | None = None) -> str:
    status = str(raw_status or "").strip().lower()
    if payment_method == "credit_card" and status in {"authorized_pending_capture", "waiting_capture"}:
        return "authorized"
    if status in {
        "pending",
        "processing",
        "authorized",
        "waiting_capture",
        "paid",
        "payment_failed",
        "failed",
        "canceled",
        "expired",
        "refunded",
        "chargedback",
    }:
        return status
    if status in {"refused", "not_authorized"}:
        return "payment_failed"
    if payment_method == "credit_card" and status in {"captured"}:
        return "paid"
    return "pending"


def _payment_flow_from_order_status(status: str) -> str:
    if status == "authorized":
        return "authorized"
    if status == "paid":
        return "paid"
    if status in {"pending", "created"}:
        return "awaiting_payment"
    if status in {"payment_failed"}:
        return "failed"
    if status == "expired":
        return "expired"
    if status in {"refunded", "partially_refunded"}:
        return "refunded"
    return "not_started"


def _first_charge(provider_response: dict) -> dict:
    charges = provider_response.get("charges")
    if isinstance(charges, list) and charges:
        charge = charges[0]
        return charge if isinstance(charge, dict) else {}
    return {}


def _last_transaction(charge: dict) -> dict:
    transaction = charge.get("last_transaction")
    return transaction if isinstance(transaction, dict) else {}


def _parse_optional_datetime(value: object) -> datetime | None:
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        normalized = value.replace("Z", "+00:00")
        try:
            return datetime.fromisoformat(normalized)
        except ValueError:
            return None
    return None


def _load_parent_payment_customer(db: Session, parent_id: UUID | str) -> dict:
    row = (
        db.execute(
            text(
                """
                select
                  p.id,
                  p.phone,
                  p.cpf,
                  u.email,
                  u.first_name,
                  u.last_name,
                  a.street,
                  a.number,
                  a.complement,
                  a.district,
                  a.city,
                  a.state,
                  a.postal_code,
                  a.country
                from parents p
                join users u on u.id = p.user_id
                join addresses a on a.id = p.address_id
                where p.id = :parent_id
                """
            ),
            {"parent_id": str(parent_id)},
        )
        .mappings()
        .first()
    )
    if not row:
        raise BookingValidationError("Parent profile is required for payment.")
    return dict(row)


def _build_pagarme_customer_payload(db: Session, parent_id: UUID | str) -> dict:
    settings = get_settings()
    customer = _load_parent_payment_customer(db, parent_id)
    phone_digits = _digits_only(customer.get("phone"))
    cpf_digits = _digits_only(customer.get("cpf"))
    postal_code = _digits_only(customer.get("postal_code"))
    address = {
        "line_1": ", ".join(
            part
            for part in [
                str(customer.get("number") or "S/N"),
                str(customer.get("street") or "").strip(),
                str(customer.get("district") or "").strip(),
            ]
            if part
        ),
        "line_2": customer.get("complement"),
        "zip_code": postal_code or "00000000",
        "city": customer.get("city") or "Nao informado",
        "state": customer.get("state") or "NA",
        "country": customer.get("country") or "BR",
    }
    if settings.pagarme_enabled:
        missing = []
        if not customer.get("email"):
            missing.append("email")
        if len(cpf_digits) != 11:
            missing.append("cpf")
        if len(phone_digits) < 10:
            missing.append("phone")
        for field in ("street", "district", "city", "state"):
            value = str(customer.get(field) or "").strip().lower()
            if not value or value == "não informado":
                missing.append(f"address.{field}")
        if len(postal_code) != 8:
            missing.append("address.postal_code")
        if missing:
            raise BookingValidationError(
                "Parent profile is missing payment-required fields: " + ", ".join(sorted(set(missing))) + "."
            )
    return {
        "name": " ".join(
            part for part in [customer.get("first_name"), customer.get("last_name")] if str(part or "").strip()
        )
        or "Cliente Kidario",
        "email": customer.get("email") or "cliente@example.invalid",
        "type": "individual",
        "document": cpf_digits or "00000000000",
        "phones": {
            "mobile_phone": {
                "country_code": "55",
                "area_code": phone_digits[:2] if len(phone_digits) >= 10 else "11",
                "number": phone_digits[2:] if len(phone_digits) >= 10 else "999999999",
            }
        },
        "address": address,
    }


def _resolve_teacher_recipient_id(db: Session, teacher_id: UUID | str) -> str:
    settings = get_settings()
    row = (
        db.execute(
            text(
                """
                select provider_recipient_id, status
                from payment_provider_recipients
                where teacher_id = :teacher_id
                  and provider = 'pagarme'
                """
            ),
            {"teacher_id": str(teacher_id)},
        )
        .mappings()
        .first()
    )
    if row and row["status"] == "active":
        return str(row["provider_recipient_id"])
    if settings.pagarme_enabled:
        raise BookingValidationError("Teacher payment recipient must be active before receiving paid bookings.")
    return f"rp_fake_teacher_{str(teacher_id).replace('-', '')[:16]}"


def _build_split_rules(db: Session, teacher_id: UUID | str, amount_cents: int) -> list[PagarmeSplitRule]:
    settings = get_settings()
    platform_percent = max(0.0, min(float(settings.platform_fee_percent or 0), 100.0))
    teacher_percent = round(100.0 - platform_percent, 4)
    platform_recipient = settings.pagarme_platform_recipient_id
    if settings.pagarme_enabled and not platform_recipient:
        raise BookingValidationError("KIDARIO_PAGARME_PLATFORM_RECIPIENT_ID is required when Pagar.me is enabled.")
    platform_recipient = platform_recipient or "rp_fake_kidario_platform"
    teacher_recipient = _resolve_teacher_recipient_id(db, teacher_id)
    return [
        PagarmeSplitRule(
            recipient_id=platform_recipient,
            split_role="platform",
            type="percentage",
            percentage=platform_percent,
            liable=True,
            charge_processing_fee=True,
            charge_remainder_fee=True,
        ),
        PagarmeSplitRule(
            recipient_id=teacher_recipient,
            split_role="teacher",
            type="percentage",
            percentage=teacher_percent,
        ),
    ]


def _order_code(prefix: str, target_id: UUID | str) -> str:
    return f"{prefix}_{str(target_id).replace('-', '')[:24]}"


def _upsert_payment_splits(
    db: Session,
    *,
    payment_order_id: UUID | str,
    payment_charge_id: UUID | str | None,
    teacher_id: UUID | str,
    split_rules: list[PagarmeSplitRule],
) -> None:
    db.execute(text("delete from payment_splits where payment_order_id = :payment_order_id"), {"payment_order_id": str(payment_order_id)})
    for split in split_rules:
        db.execute(
            text(
                """
                insert into payment_splits (
                  id,
                  payment_order_id,
                  payment_charge_id,
                  teacher_id,
                  provider,
                  provider_recipient_id,
                  split_role,
                  type,
                  amount_cents,
                  percentage,
                  liable,
                  charge_processing_fee,
                  charge_remainder_fee
                )
                values (
                  :id,
                  :payment_order_id,
                  :payment_charge_id,
                  :teacher_id,
                  'pagarme',
                  :provider_recipient_id,
                  :split_role,
                  :type,
                  :amount_cents,
                  :percentage,
                  :liable,
                  :charge_processing_fee,
                  :charge_remainder_fee
                )
                """
            ),
            {
                "id": str(uuid4()),
                "payment_order_id": str(payment_order_id),
                "payment_charge_id": str(payment_charge_id) if payment_charge_id else None,
                "teacher_id": str(teacher_id),
                "provider_recipient_id": split.recipient_id,
                "split_role": split.split_role,
                "type": split.type,
                "amount_cents": split.amount_cents,
                "percentage": split.percentage,
                "liable": split.liable,
                "charge_processing_fee": split.charge_processing_fee,
                "charge_remainder_fee": split.charge_remainder_fee,
            },
        )


def _payment_fields_from_provider_response(
    provider_response: dict,
    *,
    payment_method: str,
    fallback_amount_cents: int,
) -> dict:
    charge = _first_charge(provider_response)
    transaction = _last_transaction(charge)
    card = transaction.get("card") if isinstance(transaction.get("card"), dict) else {}
    order_status = _normalize_payment_order_status(provider_response.get("status"), payment_method)
    raw_charge_status = (
        transaction.get("status")
        if payment_method == "credit_card" and transaction.get("status")
        else charge.get("status") or transaction.get("status")
    )
    charge_status = _normalize_payment_charge_status(raw_charge_status, payment_method)
    if payment_method == "credit_card" and order_status in {"created", "pending"}:
        if charge_status in {"authorized", "waiting_capture"}:
            order_status = "authorized"
        elif charge_status == "paid":
            order_status = "paid"
        elif charge_status in {"payment_failed", "failed", "canceled", "expired"}:
            order_status = "payment_failed" if charge_status == "failed" else charge_status
    amount_cents = int(charge.get("amount") or provider_response.get("amount") or fallback_amount_cents or 0)
    paid_amount_cents = int(charge.get("paid_amount") or transaction.get("paid_amount") or 0) or None
    return {
        "provider_order_id": provider_response.get("id"),
        "provider_order_code": provider_response.get("code"),
        "provider_charge_id": charge.get("id"),
        "provider_transaction_id": transaction.get("id"),
        "order_status": order_status,
        "charge_status": charge_status,
        "amount_cents": amount_cents,
        "paid_amount_cents": paid_amount_cents,
        "pix_qr_code": transaction.get("qr_code"),
        "pix_qr_code_url": transaction.get("qr_code_url"),
        "boleto_url": transaction.get("url"),
        "payment_url": transaction.get("url"),
        "boleto_barcode": transaction.get("barcode"),
        "boleto_line": transaction.get("line"),
        "card_brand": card.get("brand"),
        "card_last_four": card.get("last_four_digits") or card.get("last_four"),
        "card_holder_name": card.get("holder_name"),
        "authorization_code": transaction.get("authorization_code") or transaction.get("acquirer_auth_code"),
        "authorized_at": _parse_optional_datetime(charge.get("authorized_at") or transaction.get("authorized_at")),
        "captured_at": _parse_optional_datetime(charge.get("captured_at") or transaction.get("captured_at")),
        "expires_at": _parse_optional_datetime(charge.get("expires_at") or transaction.get("expires_at")),
        "paid_at": _parse_optional_datetime(charge.get("paid_at") or provider_response.get("paid_at")),
    }


def _create_payment_records(
    db: Session,
    *,
    parent_id: UUID | str,
    teacher_id: UUID | str,
    booking_id: UUID | str | None,
    package_id: UUID | str | None,
    amount_cents: int,
    payment_method: str,
    order_status: str,
    charge_status: str,
    provider_response: dict | None = None,
    split_rules: list[PagarmeSplitRule] | None = None,
    installments: int = 1,
) -> dict:
    provider_response = provider_response or {}
    fields = _payment_fields_from_provider_response(
        provider_response,
        payment_method=payment_method,
        fallback_amount_cents=amount_cents,
    ) if provider_response else {
        "provider_order_id": None,
        "provider_order_code": None,
        "provider_charge_id": None,
        "provider_transaction_id": None,
        "order_status": order_status,
        "charge_status": charge_status,
        "amount_cents": amount_cents,
        "paid_amount_cents": None,
        "pix_qr_code": None,
        "pix_qr_code_url": None,
        "boleto_url": None,
        "payment_url": None,
        "boleto_barcode": None,
        "boleto_line": None,
        "card_brand": None,
        "card_last_four": None,
        "card_holder_name": None,
        "authorization_code": None,
        "authorized_at": None,
        "captured_at": None,
        "expires_at": None,
        "paid_at": None,
    }
    payment_order_id = uuid4()
    payment_charge_id = uuid4()
    db.execute(
        text(
            """
            insert into payment_orders (
              id,
              parent_id,
              booking_id,
              package_id,
              provider,
              provider_order_id,
              provider_order_code,
              requested_payment_method,
              amount_cents,
              currency,
              status,
              authorized_at,
              paid_at,
              expires_at,
              provider_response
            )
            values (
              :id,
              :parent_id,
              :booking_id,
              :package_id,
              :provider,
              :provider_order_id,
              :provider_order_code,
              :requested_payment_method,
              :amount_cents,
              'BRL',
              :status,
              :authorized_at,
              :paid_at,
              :expires_at,
              cast(:provider_response as jsonb)
            )
            """
        ),
        {
            "id": str(payment_order_id),
            "parent_id": str(parent_id),
            "booking_id": str(booking_id) if booking_id else None,
            "package_id": str(package_id) if package_id else None,
            "provider": _payment_provider(),
            "provider_order_id": fields["provider_order_id"],
            "provider_order_code": fields["provider_order_code"],
            "requested_payment_method": payment_method,
            "amount_cents": amount_cents,
            "status": fields["order_status"],
            "authorized_at": fields["authorized_at"],
            "paid_at": fields["paid_at"],
            "expires_at": fields["expires_at"],
            "provider_response": json.dumps(provider_response) if provider_response else None,
        },
    )
    db.execute(
        text(
            """
            insert into payment_charges (
              id,
              payment_order_id,
              provider,
              provider_charge_id,
              provider_transaction_id,
              payment_method,
              status,
              amount_cents,
              paid_amount_cents,
              installments,
              pix_qr_code,
              pix_qr_code_url,
              boleto_url,
              card_brand,
              card_last_four,
              card_holder_name,
              authorization_code,
              authorized_at,
              captured_at,
              expires_at,
              payment_url,
              boleto_barcode,
              boleto_line,
              paid_at,
              provider_response
            )
            values (
              :id,
              :payment_order_id,
              :provider,
              :provider_charge_id,
              :provider_transaction_id,
              :payment_method,
              :status,
              :amount_cents,
              :paid_amount_cents,
              :installments,
              :pix_qr_code,
              :pix_qr_code_url,
              :boleto_url,
              :card_brand,
              :card_last_four,
              :card_holder_name,
              :authorization_code,
              :authorized_at,
              :captured_at,
              :expires_at,
              :payment_url,
              :boleto_barcode,
              :boleto_line,
              :paid_at,
              cast(:provider_response as jsonb)
            )
            """
        ),
        {
            "id": str(payment_charge_id),
            "payment_order_id": str(payment_order_id),
            "provider": _payment_provider(),
            "provider_charge_id": fields["provider_charge_id"],
            "provider_transaction_id": fields["provider_transaction_id"],
            "payment_method": payment_method,
            "status": fields["charge_status"],
            "amount_cents": amount_cents,
            "paid_amount_cents": fields["paid_amount_cents"],
            "installments": installments,
            "pix_qr_code": fields["pix_qr_code"],
            "pix_qr_code_url": fields["pix_qr_code_url"],
            "boleto_url": fields["boleto_url"],
            "card_brand": fields["card_brand"],
            "card_last_four": fields["card_last_four"],
            "card_holder_name": fields["card_holder_name"],
            "authorization_code": fields["authorization_code"],
            "authorized_at": fields["authorized_at"],
            "captured_at": fields["captured_at"],
            "expires_at": fields["expires_at"],
            "payment_url": fields["payment_url"],
            "boleto_barcode": fields["boleto_barcode"],
            "boleto_line": fields["boleto_line"],
            "paid_at": fields["paid_at"],
            "provider_response": json.dumps(provider_response) if provider_response else None,
        },
    )
    if split_rules:
        _upsert_payment_splits(
            db,
            payment_order_id=payment_order_id,
            payment_charge_id=payment_charge_id,
            teacher_id=teacher_id,
            split_rules=split_rules,
        )
    return {"payment_order_id": payment_order_id, **fields}


def _update_payment_order_from_provider_response(
    db: Session,
    *,
    payment_order_id: UUID | str,
    payment_method: str,
    amount_cents: int,
    provider_response: dict,
    order_status: str | None = None,
    charge_status: str | None = None,
) -> dict:
    fields = _payment_fields_from_provider_response(
        provider_response,
        payment_method=payment_method,
        fallback_amount_cents=amount_cents,
    )
    if order_status:
        fields["order_status"] = order_status
    if charge_status:
        fields["charge_status"] = charge_status
    db.execute(
        text(
            """
            update payment_orders
            set provider = :provider,
                provider_order_id = coalesce(:provider_order_id, provider_order_id),
                provider_order_code = coalesce(:provider_order_code, provider_order_code),
                status = :status,
                authorized_at = coalesce(:authorized_at, authorized_at),
                paid_at = coalesce(:paid_at, paid_at),
                expires_at = coalesce(:expires_at, expires_at),
                provider_response = cast(:provider_response as jsonb),
                updated_at = now()
            where id = :payment_order_id
            """
        ),
        {
            "payment_order_id": str(payment_order_id),
            "provider": _payment_provider(),
            "provider_order_id": fields["provider_order_id"],
            "provider_order_code": fields["provider_order_code"],
            "status": fields["order_status"],
            "authorized_at": fields["authorized_at"],
            "paid_at": fields["paid_at"],
            "expires_at": fields["expires_at"],
            "provider_response": json.dumps(provider_response),
        },
    )
    db.execute(
        text(
            """
            update payment_charges
            set provider = :provider,
                provider_charge_id = coalesce(:provider_charge_id, provider_charge_id),
                provider_transaction_id = coalesce(:provider_transaction_id, provider_transaction_id),
                status = :status,
                amount_cents = :amount_cents,
                paid_amount_cents = coalesce(:paid_amount_cents, paid_amount_cents),
                pix_qr_code = coalesce(:pix_qr_code, pix_qr_code),
                pix_qr_code_url = coalesce(:pix_qr_code_url, pix_qr_code_url),
                boleto_url = coalesce(:boleto_url, boleto_url),
                card_brand = coalesce(:card_brand, card_brand),
                card_last_four = coalesce(:card_last_four, card_last_four),
                card_holder_name = coalesce(:card_holder_name, card_holder_name),
                authorization_code = coalesce(:authorization_code, authorization_code),
                authorized_at = coalesce(:authorized_at, authorized_at),
                captured_at = coalesce(:captured_at, captured_at),
                expires_at = coalesce(:expires_at, expires_at),
                payment_url = coalesce(:payment_url, payment_url),
                boleto_barcode = coalesce(:boleto_barcode, boleto_barcode),
                boleto_line = coalesce(:boleto_line, boleto_line),
                paid_at = coalesce(:paid_at, paid_at),
                provider_response = cast(:provider_response as jsonb),
                updated_at = now()
            where payment_order_id = :payment_order_id
            """
        ),
        {
            "payment_order_id": str(payment_order_id),
            "provider": _payment_provider(),
            "provider_charge_id": fields["provider_charge_id"],
            "provider_transaction_id": fields["provider_transaction_id"],
            "status": fields["charge_status"],
            "amount_cents": fields["amount_cents"],
            "paid_amount_cents": fields["paid_amount_cents"],
            "pix_qr_code": fields["pix_qr_code"],
            "pix_qr_code_url": fields["pix_qr_code_url"],
            "boleto_url": fields["boleto_url"],
            "card_brand": fields["card_brand"],
            "card_last_four": fields["card_last_four"],
            "card_holder_name": fields["card_holder_name"],
            "authorization_code": fields["authorization_code"],
            "authorized_at": fields["authorized_at"],
            "captured_at": fields["captured_at"],
            "expires_at": fields["expires_at"],
            "payment_url": fields["payment_url"],
            "boleto_barcode": fields["boleto_barcode"],
            "boleto_line": fields["boleto_line"],
            "paid_at": fields["paid_at"],
            "provider_response": json.dumps(provider_response),
        },
    )
    return fields


def _latest_payment_order_row_for_booking(db: Session, booking_id: UUID | str) -> dict:
    row = (
        db.execute(
            text(
                """
                select
                  id,
                  parent_id,
                  booking_id,
                  package_id,
                  requested_payment_method,
                  provider_order_id,
                  amount_cents,
                  status
                from payment_orders
                where booking_id = :booking_id
                order by created_at desc
                limit 1
                """
            ),
            {"booking_id": str(booking_id)},
        )
        .mappings()
        .first()
    )
    if not row:
        raise BookingValidationError("Payment order not found for booking.")
    return dict(row)


def _latest_charge_row_for_payment_order(db: Session, payment_order_id: UUID | str) -> dict | None:
    row = (
        db.execute(
            text(
                """
                select
                  id,
                  provider_charge_id,
                  payment_method,
                  status,
                  amount_cents
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


def create_booking_v2(db: Session, user: AuthUser, payload: BookingCreateRequest) -> dict:
    parent_id = _require_parent(db, user)
    resolved_child_id = _resolve_child_id(db, parent_id, payload.child_id)
    teacher = _ensure_teacher_exists(db, payload.teacher_id)
    _ensure_teacher_supports_modality(teacher, payload.modality)
    if payload.package_id:
        _resolve_active_package_for_booking(db, payload.package_id, parent_id, payload.teacher_id, resolved_child_id)
    starts_at = _normalize_starts_at(payload.starts_at)
    _ensure_minimum_booking_lead_time(starts_at)
    _ensure_slot_is_available(db, payload.teacher_id, starts_at)

    effective_duration_minutes = int(payload.duration_minutes or teacher["lesson_duration_minutes"] or 60)
    hourly_rate_cents = int(teacher["hourly_rate_cents"] or 0)
    amount_cents = 0 if payload.package_id else round(hourly_rate_cents * (effective_duration_minutes / 60))
    payment_method = payload.payment_method or "pix"
    initial_payment_flow_status = (
        "paid" if payload.package_id else "authorization_required" if payment_method == "credit_card" else "not_started"
    )

    try:
        booking_row = (
            db.execute(
                text(
                    """
                    insert into bookings
                      (
                        parent_id,
                        teacher_id,
                        package_id,
                        child_id,
                        starts_at,
                        duration_minutes,
                        modality,
                        status,
                        teacher_decision_status,
                        payment_flow_status,
                        currency
                      )
                    values
                      (
                        :parent_id,
                        :teacher_id,
                        :package_id,
                        :child_id,
                        :starts_at,
                        :duration_minutes,
                        :modality,
                        'pendente',
                        'pending',
                        :payment_flow_status,
                        'BRL'
                      )
                    returning id
                    """
                ),
                {
                    "parent_id": str(parent_id),
                    "teacher_id": str(payload.teacher_id),
                    "package_id": str(payload.package_id) if payload.package_id else None,
                    "child_id": str(resolved_child_id),
                    "starts_at": starts_at,
                    "duration_minutes": effective_duration_minutes,
                    "modality": payload.modality,
                    "payment_flow_status": initial_payment_flow_status,
                },
            )
            .mappings()
            .first()
        )
    except IntegrityError as exc:
        sqlstate = getattr(getattr(exc, "orig", None), "sqlstate", None)
        if sqlstate == "23505":
            raise BookingConflictError("Selected slot is no longer available.") from exc
        raise
    if not booking_row:
        raise BookingValidationError("Could not create booking.")

    booking_id = UUID(str(booking_row["id"]))
    if payload.package_id:
        _create_payment_records(
            db,
            parent_id=parent_id,
            teacher_id=payload.teacher_id,
            booking_id=booking_id,
            package_id=None,
            amount_cents=0,
            payment_method=payment_method,
            order_status="paid",
            charge_status="paid",
        )
    else:
        split_rules = _build_split_rules(db, payload.teacher_id, amount_cents)
        provider_response: dict | None = None
        order_status = "created"
        charge_status = "pending"
        if payment_method == "credit_card":
            try:
                provider_response = create_order(
                    get_settings(),
                    order_code=_order_code("booking", booking_id),
                    amount_cents=amount_cents,
                    payment_method=payment_method,
                    customer=_build_pagarme_customer_payload(db, parent_id),
                    item_description="Aula Kidario",
                    split_rules=split_rules,
                    card_token=payload.card_token,
                    card_id=payload.card_id,
                    installments=payload.installments,
                    capture=False,
                )
            except PagarmeIntegrationError as exc:
                raise BookingValidationError(str(exc)) from exc
            order_status = "authorized"
            charge_status = "authorized"

        payment_record = _create_payment_records(
            db,
            parent_id=parent_id,
            teacher_id=payload.teacher_id,
            booking_id=booking_id,
            package_id=None,
            amount_cents=amount_cents,
            payment_method=payment_method,
            order_status=order_status,
            charge_status=charge_status,
            provider_response=provider_response,
            split_rules=split_rules,
            installments=payload.installments,
        )
        db.execute(
            text(
                """
                update bookings
                set payment_flow_status = :payment_flow_status,
                    updated_at = now()
                where id = :booking_id
                """
            ),
            {
                "booking_id": str(booking_id),
                "payment_flow_status": _payment_flow_from_order_status(str(payment_record["order_status"])),
            },
        )

    return get_booking_v2(db, user, booking_id)


def reschedule_booking_v2(db: Session, user: AuthUser, booking_id: UUID, payload: BookingRescheduleRequest) -> dict:
    booking = _load_booking_row(db, booking_id)
    actor_parent_id, _ = get_actor_participant_ids(db, user.user_id)
    if str(booking["parent_id"]) != str(actor_parent_id):
        raise BookingPermissionError("Only the parent owner can reschedule the booking.")
    _reschedule_booking_row(db, booking, payload.starts_at)
    return get_booking_v2(db, user, booking_id)


def retry_booking_payment_v2(db: Session, user: AuthUser, booking_id: UUID, payload) -> dict:
    booking = _load_booking_row(db, booking_id)
    actor_parent_id, _ = get_actor_participant_ids(db, user.user_id)
    if str(booking["parent_id"]) != str(actor_parent_id):
        raise BookingPermissionError("Only the parent owner can retry the booking payment.")
    if booking["status"] != "pendente":
        raise BookingConflictError("Payment can only be retried for pending bookings.")
    amount_cents = int(_latest_payment_order_row_for_booking(db, booking_id).get("amount_cents") or 0)
    if amount_cents <= 0:
        raise BookingValidationError("Booking does not require a paid retry.")

    split_rules = _build_split_rules(db, booking["teacher_id"], amount_cents)
    provider_response: dict | None = None
    order_status = "created"
    charge_status = "pending"
    if payload.payment_method == "credit_card":
        try:
            provider_response = create_order(
                get_settings(),
                order_code=f"{_order_code('booking_retry', booking_id)}_{uuid4().hex[:8]}",
                amount_cents=amount_cents,
                payment_method=payload.payment_method,
                customer=_build_pagarme_customer_payload(db, booking["parent_id"]),
                item_description="Aula Kidario",
                split_rules=split_rules,
                card_token=payload.card_token,
                card_id=payload.card_id,
                installments=payload.installments,
                capture=booking["teacher_decision_status"] == "accepted",
            )
        except PagarmeIntegrationError as exc:
            raise BookingValidationError(str(exc)) from exc
        if booking["teacher_decision_status"] == "accepted":
            order_status = "paid"
            charge_status = "paid"
        else:
            order_status = "authorized"
            charge_status = "authorized"
    elif booking["teacher_decision_status"] == "accepted":
        try:
            provider_response = create_order(
                get_settings(),
                order_code=f"{_order_code('booking_retry', booking_id)}_{uuid4().hex[:8]}",
                amount_cents=amount_cents,
                payment_method=payload.payment_method,
                customer=_build_pagarme_customer_payload(db, booking["parent_id"]),
                item_description="Aula Kidario",
                split_rules=split_rules,
                capture=False,
            )
        except PagarmeIntegrationError as exc:
            raise BookingValidationError(str(exc)) from exc
        order_status = "pending"
        charge_status = "pending"

    payment_record = _create_payment_records(
        db,
        parent_id=booking["parent_id"],
        teacher_id=booking["teacher_id"],
        booking_id=booking_id,
        package_id=None,
        amount_cents=amount_cents,
        payment_method=payload.payment_method,
        order_status=order_status,
        charge_status=charge_status,
        provider_response=provider_response,
        split_rules=split_rules,
        installments=payload.installments,
    )
    record_order_status = str(payment_record["order_status"])
    next_booking_status = "confirmada" if record_order_status == "paid" else "pendente"
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
            "booking_id": str(booking_id),
            "booking_status": next_booking_status,
            "payment_flow_status": _payment_flow_from_order_status(record_order_status),
        },
    )
    return get_booking_v2(db, user, booking_id)


def teacher_reschedule_booking_v2(db: Session, user: AuthUser, booking_id: UUID, payload: BookingRescheduleRequest) -> dict:
    booking = _load_booking_row(db, booking_id)
    _, actor_teacher_id = get_actor_participant_ids(db, user.user_id)
    if str(booking["teacher_id"]) != str(actor_teacher_id):
        raise BookingPermissionError("Only the teacher owner can reschedule the booking.")
    _reschedule_booking_row(db, booking, payload.starts_at)
    return get_booking_v2(db, user, booking_id)


def decide_booking_v2(db: Session, user: AuthUser, booking_id: UUID, payload: BookingDecisionRequest) -> dict:
    booking = _load_booking_row(db, booking_id)
    _, actor_teacher_id = get_actor_participant_ids(db, user.user_id)
    if str(booking["teacher_id"]) != str(actor_teacher_id):
        raise BookingPermissionError("Only the teacher owner can decide this booking.")

    current_status = str(booking["status"])
    if payload.decision == "accept":
        if current_status != "pendente":
            raise BookingConflictError("Only pending bookings can be accepted.")
        payment_order = _latest_payment_order_row_for_booking(db, booking_id)
        payment_method = str(payment_order.get("requested_payment_method") or "pix")
        payment_order_status = str(payment_order.get("status") or "created")
        next_booking_status = "pendente"
        next_payment_flow_status = _payment_flow_from_order_status(payment_order_status)

        if payment_order_status == "paid" or int(payment_order.get("amount_cents") or 0) == 0:
            next_booking_status = "confirmada"
            next_payment_flow_status = "paid"
        elif payment_method == "credit_card":
            charge = _latest_charge_row_for_payment_order(db, payment_order["id"])
            if not charge or not charge.get("provider_charge_id"):
                raise BookingValidationError("Authorized credit card charge was not found.")
            try:
                capture_response = capture_charge(
                    get_settings(),
                    provider_charge_id=str(charge["provider_charge_id"]),
                    amount_cents=int(payment_order["amount_cents"] or 0),
                )
            except PagarmeIntegrationError as exc:
                raise BookingValidationError(str(exc)) from exc
            provider_response = {
                "id": payment_order.get("provider_order_id"),
                "code": _order_code("booking", booking_id),
                "status": "paid",
                "amount": int(payment_order["amount_cents"] or 0),
                "charges": [capture_response],
            }
            _update_payment_order_from_provider_response(
                db,
                payment_order_id=payment_order["id"],
                payment_method=payment_method,
                amount_cents=int(payment_order["amount_cents"] or 0),
                provider_response=provider_response,
                order_status="paid",
                charge_status="paid",
            )
            next_booking_status = "confirmada"
            next_payment_flow_status = "paid"
        else:
            split_rules = _build_split_rules(db, booking["teacher_id"], int(payment_order["amount_cents"] or 0))
            try:
                provider_response = create_order(
                    get_settings(),
                    order_code=_order_code("booking", booking_id),
                    amount_cents=int(payment_order["amount_cents"] or 0),
                    payment_method=payment_method,
                    customer=_build_pagarme_customer_payload(db, booking["parent_id"]),
                    item_description="Aula Kidario",
                    split_rules=split_rules,
                    capture=False,
                )
            except PagarmeIntegrationError as exc:
                raise BookingValidationError(str(exc)) from exc
            _update_payment_order_from_provider_response(
                db,
                payment_order_id=payment_order["id"],
                payment_method=payment_method,
                amount_cents=int(payment_order["amount_cents"] or 0),
                provider_response=provider_response,
                order_status="pending",
                charge_status="pending",
            )
            charge = _latest_charge_row_for_payment_order(db, payment_order["id"])
            _upsert_payment_splits(
                db,
                payment_order_id=payment_order["id"],
                payment_charge_id=charge["id"] if charge else None,
                teacher_id=booking["teacher_id"],
                split_rules=split_rules,
            )
            next_payment_flow_status = "awaiting_payment"

        updated = (
            db.execute(
                text(
                    """
                    update bookings
                    set status = :status,
                        teacher_decision_status = 'accepted',
                        teacher_decision_reason = :reason,
                        teacher_decision_at = now(),
                        payment_flow_status = :payment_flow_status,
                        confirmed_at = case when :status = 'confirmada' then coalesce(confirmed_at, now()) else confirmed_at end,
                        updated_at = now()
                    where id = :booking_id
                    returning id
                    """
                ),
                {
                    "booking_id": str(booking_id),
                    "status": next_booking_status,
                    "reason": payload.reason,
                    "payment_flow_status": next_payment_flow_status,
                },
            )
            .mappings()
            .first()
        )
        if updated and next_booking_status == "confirmada":
            ensure_teacher_activity_plan_for_booking_v2(db, user, booking_id)
    else:
        if current_status != "pendente":
            raise BookingConflictError("Only pending bookings can be rejected.")
        reason = (payload.reason or "").strip() or "Horario recusado pela professora."
        payment_order = _latest_payment_order_row_for_booking(db, booking_id)
        next_payment_flow_status = booking.get("payment_flow_status") or "not_started"
        if payment_order.get("requested_payment_method") == "credit_card" and payment_order.get("status") == "authorized":
            charge = _latest_charge_row_for_payment_order(db, payment_order["id"])
            if charge and charge.get("provider_charge_id"):
                try:
                    cancel_response = cancel_charge(
                        get_settings(),
                        provider_charge_id=str(charge["provider_charge_id"]),
                        amount_cents=int(payment_order["amount_cents"] or 0),
                    )
                except PagarmeIntegrationError as exc:
                    raise BookingValidationError(str(exc)) from exc
                _update_payment_order_from_provider_response(
                    db,
                    payment_order_id=payment_order["id"],
                    payment_method="credit_card",
                    amount_cents=int(payment_order["amount_cents"] or 0),
                    provider_response={
                        "id": payment_order.get("provider_order_id"),
                        "code": _order_code("booking", booking_id),
                        "status": "canceled",
                        "amount": int(payment_order["amount_cents"] or 0),
                        "charges": [cancel_response],
                    },
                    order_status="canceled",
                    charge_status="canceled",
                )
                next_payment_flow_status = "failed"
        updated = (
            db.execute(
                text(
                    """
                    update bookings
                    set teacher_decision_status = 'rejected',
                        teacher_decision_reason = :reason,
                        teacher_decision_at = now(),
                        payment_flow_status = :payment_flow_status,
                        updated_at = now()
                    where id = :booking_id
                    returning id
                    """
                ),
                {"booking_id": str(booking_id), "reason": reason, "payment_flow_status": next_payment_flow_status},
            )
            .mappings()
            .first()
        )
        from app.schemas.v2_chat import ChatMessageCreateRequest
        from app.services.chat_service import get_or_create_thread_from_booking, post_thread_message

        thread_payload = get_or_create_thread_from_booking(db, user, booking_id)
        message_body = (payload.chat_message or "").strip()
        if message_body:
            post_thread_message(db, user, UUID(str(thread_payload["thread"]["id"])), ChatMessageCreateRequest(body=message_body))
    if not updated:
        raise BookingNotFoundError("Booking not found.")
    return get_booking_v2(db, user, booking_id)


def cancel_booking_v2(db: Session, user: AuthUser, booking_id: UUID, payload: BookingCancelRequest) -> dict:
    booking = _load_booking_row(db, booking_id)
    actor_parent_id, _ = get_actor_participant_ids(db, user.user_id)
    if str(booking["parent_id"]) != str(actor_parent_id):
        raise BookingPermissionError("Only the parent owner can cancel the booking.")
    if booking["status"] not in ("pendente", "confirmada"):
        raise BookingConflictError("Booking cannot be cancelled in the current status.")
    updated = (
        db.execute(
            text(
                """
                update bookings
                set status = 'cancelada',
                    cancellation_reason = :reason,
                    canceled_at = coalesce(canceled_at, now()),
                    updated_at = now()
                where id = :booking_id
                returning id
                """
            ),
            {"booking_id": str(booking_id), "reason": payload.reason or "Reserva cancelada pelo responsável."},
        )
        .mappings()
        .first()
    )
    if not updated:
        raise BookingNotFoundError("Booking not found.")
    return get_booking_v2(db, user, booking_id)


def complete_booking_v2(db: Session, user: AuthUser, booking_id: UUID, payload: BookingCompleteRequest) -> dict:
    booking = _load_booking_row(db, booking_id)
    _, actor_teacher_id = get_actor_participant_ids(db, user.user_id)
    if str(booking["teacher_id"]) != str(actor_teacher_id):
        raise BookingPermissionError("Only the teacher owner can complete the booking.")
    if booking["status"] not in ("confirmada", "concluida"):
        raise BookingConflictError("Only confirmed or concluded bookings can register follow-up.")
    if booking["status"] == "confirmada" and not _can_teacher_complete_booking(
        booking_status=str(booking["status"]),
        starts_at=booking["starts_at"],
        duration_minutes=int(booking["duration_minutes"]),
    ):
        raise BookingConflictError("Lesson follow-up can only be completed after class end time.")

    follow_up = payload.follow_up
    saved_follow_up = (
        db.execute(
            text(
                """
                insert into booking_follow_ups
                  (
                    booking_id,
                    teacher_id,
                    child_id,
                    summary,
                    next_steps,
                    objectives,
                    next_objectives,
                    tags,
                    attention_points
                  )
                values
                  (
                    :booking_id,
                    :teacher_id,
                    :child_id,
                    :summary,
                    :next_steps,
                    cast(:objectives as jsonb),
                    cast(:next_objectives as jsonb),
                    :tags,
                    :attention_points
                  )
                on conflict (booking_id) do update
                set
                  teacher_id = excluded.teacher_id,
                  summary = excluded.summary,
                  next_steps = excluded.next_steps,
                  objectives = excluded.objectives,
                  next_objectives = excluded.next_objectives,
                  tags = excluded.tags,
                  attention_points = excluded.attention_points,
                  updated_at = now()
                returning updated_at
                """
            ),
            {
                "booking_id": str(booking_id),
                "teacher_id": str(booking["teacher_id"]),
                "child_id": str(booking["child_id"]),
                "summary": follow_up.summary,
                "next_steps": follow_up.next_steps,
                "objectives": json.dumps([objective.model_dump() for objective in follow_up.objectives]),
                "next_objectives": json.dumps([objective.model_dump() for objective in follow_up.next_objectives]),
                "tags": follow_up.tags,
                "attention_points": follow_up.attention_points,
            },
        )
        .mappings()
        .first()
    )
    if not saved_follow_up:
        raise BookingValidationError("Could not save follow-up.")

    updated_booking = (
        db.execute(
            text(
                """
                update bookings
                set status = case when status = 'confirmada' then 'concluida' else status end,
                    completed_at = coalesce(completed_at, now()),
                    updated_at = now()
                where id = :booking_id
                returning id
                """
            ),
            {"booking_id": str(booking_id)},
        )
        .mappings()
        .first()
    )
    if not updated_booking:
        raise BookingNotFoundError("Booking not found.")
    return get_booking_v2(db, user, booking_id)


def _reschedule_booking_row(db: Session, booking: dict, starts_at: datetime) -> dict:
    if booking["status"] not in ("pendente", "confirmada"):
        raise BookingConflictError("Booking cannot be rescheduled in the current status.")

    normalized_starts_at = _normalize_starts_at(starts_at)
    _ensure_minimum_booking_lead_time(normalized_starts_at)
    _ensure_slot_is_available(
        db,
        UUID(str(booking["teacher_id"])),
        normalized_starts_at,
        excluding_booking_id=UUID(str(booking["id"])),
    )
    try:
        row = (
            db.execute(
                text(
                    """
                    update bookings
                    set
                      starts_at = :starts_at,
                      teacher_decision_status = 'pending',
                      teacher_decision_reason = null,
                      teacher_decision_at = null,
                      updated_at = now()
                    where id = :booking_id
                    returning id, starts_at, status, updated_at
                    """
                ),
                {"booking_id": str(booking["id"]), "starts_at": normalized_starts_at},
            )
            .mappings()
            .first()
        )
    except IntegrityError as exc:
        sqlstate = getattr(getattr(exc, "orig", None), "sqlstate", None)
        if sqlstate == "23505":
            raise BookingConflictError("Selected slot is no longer available.") from exc
        raise
    if not row:
        raise BookingNotFoundError("Booking not found.")
    return dict(row)


def _load_teacher_follow_up_context_data(db: Session, user: AuthUser, booking_id: UUID) -> dict:
    teacher_id = _require_teacher(db, user)
    booking_row = (
        db.execute(
            text(
                """
                select
                  b.id,
                  b.teacher_id,
                  b.child_id,
                  b.starts_at,
                  b.duration_minutes,
                  b.modality,
                  b.status,
                  c.name as child_name,
                  c.birth_month_year as child_birth_month_year,
                  c.focus_points as child_focus_points
                from bookings b
                join children c on c.id = b.child_id
                where b.id = :booking_id
                """
            ),
            {"booking_id": str(booking_id)},
        )
        .mappings()
        .first()
    )
    if not booking_row:
        raise BookingNotFoundError("Booking not found.")
    if str(booking_row["teacher_id"]) != str(teacher_id):
        raise BookingPermissionError("Only the teacher owner can access follow-up context.")

    completed_lessons_with_child = db.execute(
        text(
            """
            select count(*)
            from bookings b
            where b.teacher_id = :teacher_id
              and b.child_id = :child_id
              and b.status = 'concluida'
              and b.starts_at < :target_starts_at
            """
        ),
        {
            "teacher_id": str(teacher_id),
            "child_id": str(booking_row["child_id"]),
            "target_starts_at": booking_row["starts_at"],
        },
    ).scalar()
    completed_lessons_with_child = int(completed_lessons_with_child or 0)

    latest_previous_follow_up = (
        db.execute(
            text(
                """
                select bf.summary, bf.objectives, bf.next_objectives
                from booking_follow_ups bf
                join bookings b_follow_up on b_follow_up.id = bf.booking_id
                where b_follow_up.teacher_id = :teacher_id
                  and b_follow_up.child_id = :child_id
                  and b_follow_up.starts_at < :target_starts_at
                order by b_follow_up.starts_at desc, bf.updated_at desc
                limit 1
                """
            ),
            {
                "teacher_id": str(teacher_id),
                "child_id": str(booking_row["child_id"]),
                "target_starts_at": booking_row["starts_at"],
            },
        )
        .mappings()
        .first()
    )

    if completed_lessons_with_child == 0:
        class_objectives = [{"objective": "Diagnóstico", "achieved": False, "fullfilment_level": 0}]
    else:
        class_objectives = _normalize_objectives(
            latest_previous_follow_up.get("next_objectives") if latest_previous_follow_up else None
        ) or _normalize_objectives(latest_previous_follow_up.get("objectives") if latest_previous_follow_up else None)
        if not class_objectives:
            class_objectives = [
                {
                    "objective": "Consolidar objetivo pedagógico principal do ciclo atual",
                    "achieved": False,
                    "fullfilment_level": 0,
                }
            ]

    parent_focus_points = (
        _parse_focus_points(booking_row.get("child_focus_points")) if completed_lessons_with_child == 0 else []
    )
    planner_input = TeacherActivityPlanInput(
        child_name=str(booking_row.get("child_name") or "Aluno"),
        child_age=None,
        completed_lessons_with_child=completed_lessons_with_child,
        objectives=[objective["objective"] for objective in class_objectives],
        parent_focus_points=parent_focus_points,
        latest_follow_up_summary=latest_previous_follow_up.get("summary") if latest_previous_follow_up else None,
    )
    return {
        "booking_row": dict(booking_row),
        "completed_lessons_with_child": completed_lessons_with_child,
        "class_objectives": class_objectives,
        "parent_focus_points": parent_focus_points,
        "planner_input": planner_input,
    }


def ensure_teacher_activity_plan_for_booking_v2(db: Session, user: AuthUser, booking_id: UUID) -> dict:
    context_data = _load_teacher_follow_up_context_data(db, user, booking_id)
    booking_row = context_data["booking_row"]
    activity_plan = get_or_create_teacher_activity_plan_for_booking(
        db=db,
        booking_id=str(booking_row["id"]),
        teacher_id=str(booking_row["teacher_id"]),
        child_id=str(booking_row["child_id"]),
        planner_input=context_data["planner_input"],
    )
    return {
        "booking_id": booking_row["id"],
        "activity_plan_source": activity_plan["source"],
        "activity_plan": activity_plan["activities"],
    }


def get_teacher_follow_up_context_v2(db: Session, user: AuthUser, booking_id: UUID) -> dict:
    context_data = _load_teacher_follow_up_context_data(db, user, booking_id)
    booking_row = context_data["booking_row"]
    cached_activity_plan = get_cached_teacher_activity_plan_for_booking(db=db, booking_id=str(booking_row["id"]))
    activity_plan = cached_activity_plan or {"source": "fallback", "activities": []}
    return {
        "booking_id": booking_row["id"],
        "child_id": booking_row["child_id"],
        "child_name": booking_row["child_name"] or "Aluno",
        "child_birth_month_year": booking_row["child_birth_month_year"],
        "starts_at": booking_row["starts_at"],
        "duration_minutes": booking_row["duration_minutes"],
        "modality": booking_row["modality"],
        "status": booking_row["status"],
        "completed_lessons_with_child": context_data["completed_lessons_with_child"],
        "class_objectives": context_data["class_objectives"],
        "parent_focus_points": context_data["parent_focus_points"],
        "activity_plan_source": activity_plan["source"],
        "activity_plan": activity_plan["activities"],
    }


def get_teacher_availability_slots_v2(
    db: Session,
    teacher_id: UUID,
    date_from: date,
    date_to: date,
    duration_minutes: int,
) -> dict:
    if duration_minutes <= 0:
        raise BookingValidationError("duration_minutes must be greater than zero.")
    if date_to < date_from:
        raise BookingValidationError("to date must be greater than or equal to from date.")
    _ensure_teacher_exists(db, teacher_id)

    schedule_rows = (
        db.execute(
            text(
                """
                select day_of_week, start_time, end_time
                from teacher_availability
                where teacher_id = :teacher_id
                order by day_of_week asc, start_time asc
                """
            ),
            {"teacher_id": str(teacher_id)},
        )
        .mappings()
        .all()
    )

    start_bound = datetime.combine(date_from, time.min, tzinfo=LOCAL_TZ)
    end_bound = datetime.combine(date_to + timedelta(days=1), time.min, tzinfo=LOCAL_TZ)
    booked_rows = (
        db.execute(
            text(
                """
                select starts_at
                from bookings
                where teacher_id = :teacher_id
                  and starts_at >= :start_bound
                  and starts_at < :end_bound
                  and status in ('pendente', 'confirmada')
                  and coalesce(teacher_decision_status, 'pending') <> 'rejected'
                """
            ),
            {"teacher_id": str(teacher_id), "start_bound": start_bound, "end_bound": end_bound},
        )
        .mappings()
        .all()
    )
    booked_by_date: dict[date, set[str]] = {}
    for row in booked_rows:
        starts_at = row["starts_at"]
        local_starts_at = starts_at.astimezone(LOCAL_TZ) if starts_at.tzinfo else starts_at.replace(tzinfo=LOCAL_TZ)
        booked_by_date.setdefault(local_starts_at.date(), set()).add(local_starts_at.strftime("%H:%M"))

    rows_by_day: dict[int, list[dict]] = {}
    for row in schedule_rows:
        rows_by_day.setdefault(int(row["day_of_week"]), []).append(dict(row))

    slots = []
    minimum_start = datetime.now(LOCAL_TZ) + timedelta(minutes=MIN_BOOKING_LEAD_MINUTES)
    current_date = date_from
    while current_date <= date_to:
        available_starts: list[datetime] = []
        blocked_times = booked_by_date.get(current_date, set())
        for schedule in rows_by_day.get(current_date.weekday(), []):
            start_minutes = _time_to_minutes(schedule["start_time"])
            end_minutes = _time_to_minutes(schedule["end_time"])
            minute = start_minutes
            while minute + duration_minutes <= end_minutes:
                time_value = _minutes_to_time(minute)
                starts_at = _build_starts_at(current_date, time_value)
                if starts_at >= minimum_start and time_value not in blocked_times:
                    available_starts.append(starts_at)
                minute += duration_minutes
        if available_starts:
            slots.append({"date": current_date, "starts_at": sorted(set(available_starts))})
        current_date += timedelta(days=1)

    return {"teacher_id": teacher_id, "slots": slots}


def _time_to_minutes(value: object) -> int:
    if isinstance(value, time):
        return value.hour * 60 + value.minute

    parts = str(value).strip().split(":")
    if len(parts) < 2:
        raise ValueError(f"Invalid time value: {value!r}")
    return int(parts[0]) * 60 + int(parts[1])


def _minutes_to_time(total_minutes: int) -> str:
    hours = total_minutes // 60
    minutes = total_minutes % 60
    return f"{hours:02d}:{minutes:02d}"


def _build_starts_at(date_value: date, time_value: str) -> datetime:
    hours_part, minutes_part = time_value.split(":", maxsplit=1)
    return datetime(
        year=date_value.year,
        month=date_value.month,
        day=date_value.day,
        hour=int(hours_part),
        minute=int(minutes_part),
        tzinfo=LOCAL_TZ,
    )


def get_booking_payment_v2(db: Session, user: AuthUser, booking_id: UUID) -> dict:
    booking = get_booking_v2(db, user, booking_id)
    payment_order = booking.get("payment_order")
    if not payment_order:
        raise BookingNotFoundError("Payment order not found.")
    return payment_order


def list_parent_payments_v2(db: Session, user: AuthUser, *, limit: int = 50, offset: int = 0) -> dict:
    parent_id = _require_parent(db, user)
    rows = (
        db.execute(
            text(
                """
                select
                  id,
                  parent_id,
                  booking_id,
                  package_id,
                  provider,
                  provider_order_id,
                  provider_order_code,
                  requested_payment_method,
                  amount_cents,
                  currency,
                  status,
                  authorized_at,
                  paid_at,
                  expires_at,
                  created_at,
                  updated_at
                from payment_orders
                where parent_id = :parent_id
                order by created_at desc
                limit :limit
                offset :offset
                """
            ),
            {"parent_id": str(parent_id), "limit": limit, "offset": offset},
        )
        .mappings()
        .all()
    )
    return {"payments": [_map_payment_order(db, dict(row)) for row in rows]}


def list_teacher_payments_v2(db: Session, user: AuthUser, *, limit: int = 50, offset: int = 0) -> dict:
    teacher_id = _require_teacher(db, user)
    rows = (
        db.execute(
            text(
                """
                select distinct
                  po.id,
                  po.parent_id,
                  po.booking_id,
                  po.package_id,
                  po.provider,
                  po.provider_order_id,
                  po.provider_order_code,
                  po.requested_payment_method,
                  po.amount_cents,
                  po.currency,
                  po.status,
                  po.authorized_at,
                  po.paid_at,
                  po.expires_at,
                  po.created_at,
                  po.updated_at
                from payment_orders po
                left join bookings b on b.id = po.booking_id
                left join booking_packages bp on bp.id = po.package_id
                where b.teacher_id = :teacher_id
                   or bp.teacher_id = :teacher_id
                order by po.created_at desc
                limit :limit
                offset :offset
                """
            ),
            {"teacher_id": str(teacher_id), "limit": limit, "offset": offset},
        )
        .mappings()
        .all()
    )
    return {"payments": [_map_payment_order(db, dict(row)) for row in rows]}


__all__ = [
    "BookingConflictError",
    "BookingNotFoundError",
    "BookingPermissionError",
    "BookingValidationError",
]
