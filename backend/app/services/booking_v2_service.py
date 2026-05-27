from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import AuthUser
from app.schemas.bookings import (
    BookingCancelPatch as LegacyBookingCancelPatch,
    BookingCompletePatch as LegacyBookingCompletePatch,
    BookingCreateRequest as LegacyBookingCreateRequest,
    BookingFollowUpPayload as LegacyBookingFollowUpPayload,
    BookingObjectiveItem as LegacyBookingObjectiveItem,
    BookingReschedulePatch as LegacyBookingReschedulePatch,
    TeacherBookingDecisionPatch as LegacyTeacherBookingDecisionPatch,
)
from app.schemas.v2_bookings import (
    BookingCancelRequest,
    BookingCompleteRequest,
    BookingCreateRequest,
    BookingDecisionRequest,
    BookingRescheduleRequest,
)
from app.services.booking_service import (
    BookingConflictError,
    BookingNotFoundError,
    BookingPermissionError,
    BookingValidationError,
    _can_teacher_complete_booking,
    _normalize_objectives,
    cancel_booking as legacy_cancel_booking,
    complete_booking as legacy_complete_booking,
    create_booking as legacy_create_booking,
    reschedule_booking as legacy_reschedule_booking,
    teacher_decide_booking as legacy_teacher_decide_booking,
    teacher_reschedule_booking as legacy_teacher_reschedule_booking,
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
                  amount_cents,
                  currency,
                  status,
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
        "amount_cents": int(row["amount_cents"] or 0),
        "currency": row["currency"] or "BRL",
        "status": row["status"],
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


def create_booking_v2(db: Session, user: AuthUser, payload: BookingCreateRequest) -> dict:
    legacy_payload_data = payload.model_dump()
    if legacy_payload_data["payment_method"] is None:
        legacy_payload_data["payment_method"] = "pix"
    legacy_payload = LegacyBookingCreateRequest(**legacy_payload_data)
    created = legacy_create_booking(db, user, legacy_payload)
    return get_booking_v2(db, user, UUID(str(created["booking_id"])))


def reschedule_booking_v2(db: Session, user: AuthUser, booking_id: UUID, payload: BookingRescheduleRequest) -> dict:
    legacy_payload = LegacyBookingReschedulePatch(**payload.model_dump())
    legacy_reschedule_booking(db, user, booking_id, legacy_payload)
    return get_booking_v2(db, user, booking_id)


def teacher_reschedule_booking_v2(db: Session, user: AuthUser, booking_id: UUID, payload: BookingRescheduleRequest) -> dict:
    legacy_payload = LegacyBookingReschedulePatch(**payload.model_dump())
    legacy_teacher_reschedule_booking(db, user, booking_id, legacy_payload)
    return get_booking_v2(db, user, booking_id)


def decide_booking_v2(db: Session, user: AuthUser, booking_id: UUID, payload: BookingDecisionRequest) -> dict:
    legacy_payload = LegacyTeacherBookingDecisionPatch(
        action=payload.decision,
        reason=payload.reason,
    )
    legacy_teacher_decide_booking(db, user, booking_id, legacy_payload)
    return get_booking_v2(db, user, booking_id)


def cancel_booking_v2(db: Session, user: AuthUser, booking_id: UUID, payload: BookingCancelRequest) -> dict:
    legacy_payload = LegacyBookingCancelPatch(reason=(payload.reason or "Reserva cancelada pelo responsável."))
    legacy_cancel_booking(db, user, booking_id, legacy_payload)
    return get_booking_v2(db, user, booking_id)


def complete_booking_v2(db: Session, user: AuthUser, booking_id: UUID, payload: BookingCompleteRequest) -> dict:
    follow_up = payload.follow_up
    legacy_payload = LegacyBookingCompletePatch(
        follow_up=LegacyBookingFollowUpPayload(
            summary=follow_up.summary,
            next_steps=follow_up.next_steps,
            objectives=[LegacyBookingObjectiveItem(**item.model_dump()) for item in follow_up.objectives],
            next_objectives=[LegacyBookingObjectiveItem(**item.model_dump()) for item in follow_up.next_objectives],
            tags=follow_up.tags,
            attention_points=follow_up.attention_points,
        )
    )
    legacy_complete_booking(db, user, booking_id, legacy_payload)
    return get_booking_v2(db, user, booking_id)


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
                  amount_cents,
                  currency,
                  status,
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
                  po.amount_cents,
                  po.currency,
                  po.status,
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
