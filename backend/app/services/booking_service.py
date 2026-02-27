import json
from datetime import date, datetime, timedelta
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import AuthUser
from app.schemas.bookings import (
    BookingCancelPatch,
    BookingCompletePatch,
    BookingCreateRequest,
    BookingReschedulePatch,
    TeacherBookingDecisionPatch,
)
from app.services.teacher_activity_planner_service import (
    TeacherActivityPlanInput,
    generate_teacher_activity_plan,
)
from app.services.storage_url_service import resolve_teacher_profile_photo_url


class BookingValidationError(Exception):
    pass


class BookingConflictError(Exception):
    pass


class BookingNotFoundError(Exception):
    pass


class BookingPermissionError(Exception):
    pass


def _format_date_label(date_value: date) -> str:
    return date_value.strftime("%d/%m/%Y")


def _time_to_minutes(value: str) -> int:
    hours_part, minutes_part = value.split(":", maxsplit=1)
    return int(hours_part) * 60 + int(minutes_part)


def _minutes_to_time(total_minutes: int) -> str:
    hours = total_minutes // 60
    minutes = total_minutes % 60
    return f"{hours:02d}:{minutes:02d}"


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
            if not objective_text:
                continue
            normalized_objectives.append(
                {
                    "objective": objective_text,
                    "achieved": False,
                    "fullfilment_level": 0,
                }
            )
            continue

        if not isinstance(raw_item, dict):
            continue

        objective_text = str(raw_item.get("objective", "")).strip()
        if not objective_text:
            continue

        fullfilment_level_raw = raw_item.get("fullfilment_level", raw_item.get("fulfilment_level"))
        fullfilment_level: int
        if isinstance(fullfilment_level_raw, int) and 0 <= fullfilment_level_raw <= 5:
            fullfilment_level = fullfilment_level_raw
        else:
            fullfilment_level = 0

        normalized_objectives.append(
            {
                "objective": objective_text,
                "achieved": bool(raw_item.get("achieved", False)),
                "fullfilment_level": fullfilment_level,
            }
        )

    return normalized_objectives


def _booking_start_datetime(date_iso: date, time_value: str) -> datetime:
    hours_part, minutes_part = time_value.split(":", maxsplit=1)
    return datetime(
        year=date_iso.year,
        month=date_iso.month,
        day=date_iso.day,
        hour=int(hours_part),
        minute=int(minutes_part),
    )


def _can_teacher_complete_booking(*, booking_status: str, date_iso: date, time_value: str, duration_minutes: int) -> bool:
    if booking_status == "concluida":
        return True
    if booking_status != "confirmada":
        return False

    lesson_end = _booking_start_datetime(date_iso, time_value) + timedelta(minutes=int(duration_minutes or 0))
    return lesson_end <= datetime.now()


def _parse_focus_points(raw_focus_points: str | None) -> list[str]:
    if not raw_focus_points:
        return []

    normalized = raw_focus_points.strip()
    if not normalized:
        return []

    separators = ["\n", ";", ",", "•"]
    points = [normalized]
    for separator in separators:
        next_points: list[str] = []
        for point in points:
            next_points.extend(point.split(separator))
        points = next_points

    output: list[str] = []
    for point in points:
        cleaned = point.strip(" -\t")
        if cleaned:
            output.append(cleaned)
    return output


def _ensure_parent_role(db: Session, profile_id: str) -> None:
    role = db.execute(text("select role from profiles where id = :profile_id"), {"profile_id": profile_id}).scalar()
    if role != "parent":
        raise BookingPermissionError("Only parent users can perform this action.")


def _ensure_teacher_role(db: Session, profile_id: str) -> None:
    role = db.execute(text("select role from profiles where id = :profile_id"), {"profile_id": profile_id}).scalar()
    if role != "teacher":
        raise BookingPermissionError("Only teacher users can perform this action.")


def _resolve_child_id(db: Session, profile_id: str, child_id: UUID | None) -> UUID:
    if child_id:
        row = (
            db.execute(
                text(
                    """
                    select id
                    from parent_children
                    where id = :child_id and profile_id = :profile_id
                    """
                ),
                {"child_id": str(child_id), "profile_id": profile_id},
            )
            .mappings()
            .first()
        )
        if not row:
            raise BookingValidationError("child_id does not belong to the authenticated parent.")
        return UUID(str(row["id"]))

    rows = (
        db.execute(
            text("select id from parent_children where profile_id = :profile_id order by created_at asc"),
            {"profile_id": profile_id},
        )
        .mappings()
        .all()
    )
    if len(rows) == 1:
        return UUID(str(rows[0]["id"]))
    if len(rows) == 0:
        raise BookingValidationError("Parent profile does not have children yet.")
    raise BookingValidationError("Multiple children found. child_id is required.")


def _ensure_teacher_exists(db: Session, teacher_profile_id: UUID) -> None:
    exists = db.execute(
        text("select exists(select 1 from teacher_profiles where profile_id = :profile_id)"),
        {"profile_id": str(teacher_profile_id)},
    ).scalar_one()
    if not exists:
        raise BookingValidationError("Teacher profile not found.")


def _ensure_teacher_supports_modality(db: Session, teacher_profile_id: UUID, requested_modality: str) -> None:
    row = (
        db.execute(
            text("select modality from teacher_profiles where profile_id = :profile_id"),
            {"profile_id": str(teacher_profile_id)},
        )
        .mappings()
        .first()
    )
    if not row:
        raise BookingValidationError("Teacher profile not found.")

    teacher_modality = row.get("modality")
    normalized_modality = str(teacher_modality).strip().lower() if teacher_modality else "online"
    if normalized_modality == "hibrido":
        return
    if normalized_modality != requested_modality:
        raise BookingValidationError("Selected modality is not offered by this teacher.")


def _ensure_slot_is_available(
    db: Session,
    teacher_profile_id: UUID,
    date_iso: date,
    time_value: str,
    excluding_booking_id: UUID | None = None,
) -> None:
    filters = """
        teacher_profile_id = :teacher_profile_id
        and date_iso = :date_iso
        and time = :time
        and status in ('pendente', 'confirmada')
    """
    params: dict[str, object] = {
        "teacher_profile_id": str(teacher_profile_id),
        "date_iso": date_iso,
        "time": time_value,
    }
    if excluding_booking_id:
        filters += " and id <> :excluding_booking_id"
        params["excluding_booking_id"] = str(excluding_booking_id)

    exists = db.execute(
        text(f"select exists(select 1 from bookings where {filters})"),
        params,
    ).scalar_one()
    if exists:
        raise BookingConflictError("Selected slot is no longer available.")


def _get_booking_for_actor(db: Session, booking_id: UUID, actor_profile_id: str) -> dict:
    booking = (
        db.execute(
            text(
                """
                select
                  b.id,
                  b.parent_profile_id,
                  b.child_id,
                  b.teacher_profile_id,
                  b.date_iso,
                  b.time,
                  b.duration_minutes,
                  b.modality,
                  b.status,
                  b.payment_status,
                  b.price_total,
                  b.currency,
                  b.cancellation_reason,
                  b.created_at,
                  b.updated_at,
                  pc.name as child_name,
                  pp.first_name as teacher_first_name,
                  pp.last_name as teacher_last_name,
                  tp.profile_photo_file_name as teacher_avatar_url,
                  coalesce(ts.specialty, 'Apoio pedagogico') as specialty
                from bookings b
                join parent_children pc on pc.id = b.child_id
                join profiles pp on pp.id = b.teacher_profile_id
                left join teacher_profiles tp on tp.profile_id = b.teacher_profile_id
                left join lateral (
                  select specialty
                  from teacher_specialties
                  where profile_id = b.teacher_profile_id
                  order by created_at asc
                  limit 1
                ) ts on true
                where b.id = :booking_id
                """
            ),
            {"booking_id": str(booking_id)},
        )
        .mappings()
        .first()
    )

    if not booking:
        raise BookingNotFoundError("Booking not found.")

    is_parent_owner = str(booking["parent_profile_id"]) == actor_profile_id
    is_teacher_owner = str(booking["teacher_profile_id"]) == actor_profile_id
    if not is_parent_owner and not is_teacher_owner:
        raise BookingPermissionError("You do not have access to this booking.")

    return dict(booking)


def create_booking(db: Session, user: AuthUser, payload: BookingCreateRequest) -> dict:
    _ensure_parent_role(db, user.user_id)

    if payload.parent_profile_id and str(payload.parent_profile_id) != user.user_id:
        raise BookingPermissionError("parent_profile_id does not match the authenticated user.")

    resolved_child_id = _resolve_child_id(db, user.user_id, payload.child_id)
    _ensure_teacher_exists(db, payload.teacher_profile_id)
    _ensure_teacher_supports_modality(db, payload.teacher_profile_id, payload.modality)
    _ensure_slot_is_available(db, payload.teacher_profile_id, payload.date_iso, payload.time)

    teacher_hourly_rate = db.execute(
        text("select hourly_rate from teacher_profiles where profile_id = :profile_id"),
        {"profile_id": str(payload.teacher_profile_id)},
    ).scalar()

    hourly_rate_value = float(teacher_hourly_rate or 0)
    price_total = round(hourly_rate_value * (payload.duration_minutes / 60), 2)
    payment_status = "pago" if payload.payment_method == "cartao" else "pendente"
    booking_status = "pendente"

    row = (
        db.execute(
            text(
                """
                insert into bookings
                  (
                    parent_profile_id,
                    child_id,
                    teacher_profile_id,
                    date_iso,
                    time,
                    duration_minutes,
                    modality,
                    status,
                    payment_method,
                    payment_status,
                    price_total,
                    currency
                  )
                values
                  (
                    :parent_profile_id,
                    :child_id,
                    :teacher_profile_id,
                    :date_iso,
                    :time,
                    :duration_minutes,
                    :modality,
                    :status,
                    :payment_method,
                    :payment_status,
                    :price_total,
                    'BRL'
                  )
                returning id, status, payment_status
                """
            ),
            {
                "parent_profile_id": user.user_id,
                "child_id": str(resolved_child_id),
                "teacher_profile_id": str(payload.teacher_profile_id),
                "date_iso": payload.date_iso,
                "time": payload.time,
                "duration_minutes": payload.duration_minutes,
                "modality": payload.modality,
                "status": booking_status,
                "payment_method": payload.payment_method,
                "payment_status": payment_status,
                "price_total": price_total,
            },
        )
        .mappings()
        .first()
    )
    if not row:
        raise BookingValidationError("Could not create booking.")

    return {
        "status": "ok",
        "booking_id": UUID(str(row["id"])),
        "booking_status": row["status"],
        "payment_status": row["payment_status"],
    }


def get_parent_agenda(db: Session, user: AuthUser, tab: str, child_id: UUID | None) -> dict:
    settings = get_settings()
    _ensure_parent_role(db, user.user_id)

    where_clauses = ["b.parent_profile_id = :parent_profile_id"]
    params: dict[str, object] = {"parent_profile_id": user.user_id}

    if tab == "past":
        where_clauses.append("b.date_iso < current_date")
    else:
        where_clauses.append("b.date_iso >= current_date")

    if child_id:
        where_clauses.append("b.child_id = :child_id")
        params["child_id"] = str(child_id)

    order_direction = "desc" if tab == "past" else "asc"

    rows = (
        db.execute(
            text(
                f"""
                select
                  b.id,
                  b.teacher_profile_id as teacher_id,
                  coalesce(nullif(trim(concat_ws(' ', tp_profile.first_name, tp_profile.last_name)), ''), 'Professora Kidario') as teacher_name,
                  tp.profile_photo_file_name as teacher_avatar_url,
                  coalesce(ts.specialty, 'Apoio pedagogico') as specialty,
                  b.child_id,
                  pc.name as child_name,
                  b.date_iso,
                  b.time,
                  b.modality,
                  b.status,
                  b.created_at as created_at_iso,
                  b.updated_at as updated_at_iso
                from bookings b
                join parent_children pc on pc.id = b.child_id
                join profiles tp_profile on tp_profile.id = b.teacher_profile_id
                left join teacher_profiles tp on tp.profile_id = b.teacher_profile_id
                left join lateral (
                  select specialty
                  from teacher_specialties
                  where profile_id = b.teacher_profile_id
                  order by created_at asc
                  limit 1
                ) ts on true
                where {' and '.join(where_clauses)}
                order by b.date_iso {order_direction}, b.time {order_direction}
                """
            ),
            params,
        )
        .mappings()
        .all()
    )

    lessons = []
    for row in rows:
        lesson = dict(row)
        lesson["teacher_avatar_url"] = resolve_teacher_profile_photo_url(settings, lesson.get("teacher_avatar_url"))
        lesson["date_label"] = _format_date_label(row["date_iso"])
        lessons.append(lesson)
    return {"lessons": lessons}


def get_teacher_agenda(db: Session, user: AuthUser, tab: str, status: str | None) -> dict:
    _ensure_teacher_role(db, user.user_id)

    where_clauses = ["b.teacher_profile_id = :teacher_profile_id"]
    params: dict[str, object] = {"teacher_profile_id": user.user_id}

    if tab == "past":
        where_clauses.append("b.date_iso < current_date")
    else:
        where_clauses.append("b.date_iso >= current_date")

    if status:
        where_clauses.append("b.status = :status")
        params["status"] = status

    order_direction = "desc" if tab == "past" else "asc"

    rows = (
        db.execute(
            text(
                f"""
                select
                  b.id,
                  b.parent_profile_id,
                  b.child_id,
                  pc.name as child_name,
                  pc.age as child_age,
                  b.date_iso,
                  b.time,
                  b.duration_minutes,
                  b.modality,
                  b.status
                from bookings b
                join parent_children pc on pc.id = b.child_id
                where {' and '.join(where_clauses)}
                order by b.date_iso {order_direction}, b.time {order_direction}
                """
            ),
            params,
        )
        .mappings()
        .all()
    )
    return {"lessons": [dict(row) for row in rows]}


def get_booking_detail(db: Session, user: AuthUser, booking_id: UUID) -> dict:
    settings = get_settings()
    booking = _get_booking_for_actor(db, booking_id, user.user_id)

    follow_up = (
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

    is_parent_owner = str(booking["parent_profile_id"]) == user.user_id
    is_teacher_owner = str(booking["teacher_profile_id"]) == user.user_id
    can_reschedule_or_cancel = booking["status"] in ("pendente", "confirmada")

    teacher_name_parts = [booking.get("teacher_first_name"), booking.get("teacher_last_name")]
    teacher_name = " ".join(part for part in teacher_name_parts if part).strip() or "Professora Kidario"

    response = {
        "id": booking["id"],
        "parent_profile_id": booking["parent_profile_id"],
        "child_id": booking["child_id"],
        "child_name": booking["child_name"],
        "teacher_id": booking["teacher_profile_id"],
        "teacher_name": teacher_name,
        "teacher_avatar_url": resolve_teacher_profile_photo_url(settings, booking["teacher_avatar_url"]),
        "specialty": booking["specialty"],
        "date_iso": booking["date_iso"],
        "date_label": _format_date_label(booking["date_iso"]),
        "time": booking["time"],
        "duration_minutes": booking["duration_minutes"],
        "modality": booking["modality"],
        "status": booking["status"],
        "price_total": float(booking["price_total"]),
        "currency": booking["currency"],
        "cancellation_reason": booking["cancellation_reason"],
        "latest_follow_up": None,
        "actions": {
            "can_reschedule": bool(is_parent_owner and can_reschedule_or_cancel),
            "can_cancel": bool(is_parent_owner and can_reschedule_or_cancel),
            "can_complete": bool(
                is_teacher_owner
                and _can_teacher_complete_booking(
                    booking_status=str(booking["status"]),
                    date_iso=booking["date_iso"],
                    time_value=str(booking["time"]),
                    duration_minutes=int(booking["duration_minutes"]),
                )
            ),
        },
    }
    if follow_up:
        response["latest_follow_up"] = {
            "updated_at": follow_up["updated_at"],
            "summary": follow_up["summary"],
            "next_steps": follow_up["next_steps"],
            "objectives": _normalize_objectives(follow_up.get("objectives")),
            "next_objectives": _normalize_objectives(follow_up.get("next_objectives")),
            "tags": list(follow_up["tags"] or []),
            "attention_points": list(follow_up["attention_points"] or []),
        }
    return response


def reschedule_booking(db: Session, user: AuthUser, booking_id: UUID, payload: BookingReschedulePatch) -> dict:
    booking = _get_booking_for_actor(db, booking_id, user.user_id)

    if str(booking["parent_profile_id"]) != user.user_id:
        raise BookingPermissionError("Only the parent owner can reschedule the booking.")
    if booking["status"] not in ("pendente", "confirmada"):
        raise BookingConflictError("Booking cannot be rescheduled in the current status.")

    _ensure_slot_is_available(
        db,
        UUID(str(booking["teacher_profile_id"])),
        payload.new_date_iso,
        payload.new_time,
        excluding_booking_id=booking_id,
    )

    updated = (
        db.execute(
            text(
                """
                update bookings
                set
                  date_iso = :date_iso,
                  time = :time,
                  updated_at = now()
                where id = :booking_id
                returning id, date_iso, time, status, updated_at
                """
            ),
            {"booking_id": str(booking_id), "date_iso": payload.new_date_iso, "time": payload.new_time},
        )
        .mappings()
        .first()
    )
    if not updated:
        raise BookingNotFoundError("Booking not found.")

    return {
        "status": "ok",
        "booking_id": updated["id"],
        "date_iso": updated["date_iso"],
        "time": updated["time"],
        "booking_status": updated["status"],
        "updated_at_iso": updated["updated_at"],
    }


def teacher_decide_booking(
    db: Session,
    user: AuthUser,
    booking_id: UUID,
    payload: TeacherBookingDecisionPatch,
) -> dict:
    booking = _get_booking_for_actor(db, booking_id, user.user_id)

    if str(booking["teacher_profile_id"]) != user.user_id:
        raise BookingPermissionError("Only the teacher owner can decide this booking.")

    current_status = str(booking["status"])
    if payload.action == "accept":
        if current_status != "pendente":
            raise BookingConflictError("Only pending bookings can be accepted.")

        updated = (
            db.execute(
                text(
                    """
                    update bookings
                    set status = 'confirmada', updated_at = now()
                    where id = :booking_id
                    returning id, status, updated_at, cancellation_reason
                    """
                ),
                {"booking_id": str(booking_id)},
            )
            .mappings()
            .first()
        )
    else:
        if current_status not in ("pendente", "confirmada"):
            raise BookingConflictError("Only pending or confirmed bookings can be rejected.")

        reason = (payload.reason or "").strip() or "Reserva recusada pela professora."
        updated = (
            db.execute(
                text(
                    """
                    update bookings
                    set
                      status = 'cancelada',
                      cancellation_reason = :reason,
                      updated_at = now()
                    where id = :booking_id
                    returning id, status, updated_at, cancellation_reason
                    """
                ),
                {"booking_id": str(booking_id), "reason": reason},
            )
            .mappings()
            .first()
        )

    if not updated:
        raise BookingNotFoundError("Booking not found.")

    return {
        "status": "ok",
        "booking_id": updated["id"],
        "booking_status": updated["status"],
        "updated_at_iso": updated["updated_at"],
        "cancellation_reason": updated["cancellation_reason"],
    }


def teacher_reschedule_booking(
    db: Session,
    user: AuthUser,
    booking_id: UUID,
    payload: BookingReschedulePatch,
) -> dict:
    booking = _get_booking_for_actor(db, booking_id, user.user_id)

    if str(booking["teacher_profile_id"]) != user.user_id:
        raise BookingPermissionError("Only the teacher owner can reschedule the booking.")
    if booking["status"] not in ("pendente", "confirmada"):
        raise BookingConflictError("Booking cannot be rescheduled in the current status.")

    _ensure_slot_is_available(
        db,
        UUID(str(booking["teacher_profile_id"])),
        payload.new_date_iso,
        payload.new_time,
        excluding_booking_id=booking_id,
    )

    updated = (
        db.execute(
            text(
                """
                update bookings
                set
                  date_iso = :date_iso,
                  time = :time,
                  updated_at = now()
                where id = :booking_id
                returning id, date_iso, time, status, updated_at
                """
            ),
            {"booking_id": str(booking_id), "date_iso": payload.new_date_iso, "time": payload.new_time},
        )
        .mappings()
        .first()
    )
    if not updated:
        raise BookingNotFoundError("Booking not found.")

    return {
        "status": "ok",
        "booking_id": updated["id"],
        "date_iso": updated["date_iso"],
        "time": updated["time"],
        "booking_status": updated["status"],
        "updated_at_iso": updated["updated_at"],
    }


def cancel_booking(db: Session, user: AuthUser, booking_id: UUID, payload: BookingCancelPatch) -> dict:
    booking = _get_booking_for_actor(db, booking_id, user.user_id)

    if str(booking["parent_profile_id"]) != user.user_id:
        raise BookingPermissionError("Only the parent owner can cancel the booking.")
    if booking["status"] not in ("pendente", "confirmada"):
        raise BookingConflictError("Booking cannot be cancelled in the current status.")

    updated = (
        db.execute(
            text(
                """
                update bookings
                set
                  status = 'cancelada',
                  cancellation_reason = :reason,
                  updated_at = now()
                where id = :booking_id
                returning id, status, cancellation_reason, updated_at
                """
            ),
            {"booking_id": str(booking_id), "reason": payload.reason},
        )
        .mappings()
        .first()
    )
    if not updated:
        raise BookingNotFoundError("Booking not found.")

    return {
        "status": "ok",
        "booking_id": updated["id"],
        "booking_status": updated["status"],
        "cancellation_reason": updated["cancellation_reason"],
        "updated_at_iso": updated["updated_at"],
    }


def complete_booking(db: Session, user: AuthUser, booking_id: UUID, payload: BookingCompletePatch) -> dict:
    booking = _get_booking_for_actor(db, booking_id, user.user_id)

    if str(booking["teacher_profile_id"]) != user.user_id:
        raise BookingPermissionError("Only the teacher owner can complete the booking.")
    if booking["status"] not in ("confirmada", "concluida"):
        raise BookingConflictError("Only confirmed or concluded bookings can register follow-up.")
    if (
        booking["status"] == "confirmada"
        and not _can_teacher_complete_booking(
            booking_status=str(booking["status"]),
            date_iso=booking["date_iso"],
            time_value=str(booking["time"]),
            duration_minutes=int(booking["duration_minutes"]),
        )
    ):
        raise BookingConflictError("Lesson follow-up can only be completed after class end time.")

    follow_up = (
        db.execute(
            text(
                """
                insert into booking_follow_ups
                  (
                    booking_id,
                    teacher_profile_id,
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
                    :teacher_profile_id,
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
                  summary = excluded.summary,
                  next_steps = excluded.next_steps,
                  objectives = excluded.objectives,
                  next_objectives = excluded.next_objectives,
                  tags = excluded.tags,
                  attention_points = excluded.attention_points,
                  updated_at = now()
                returning updated_at, summary, next_steps, objectives, next_objectives, tags, attention_points
                """
            ),
            {
                "booking_id": str(booking_id),
                "teacher_profile_id": str(booking["teacher_profile_id"]),
                "child_id": str(booking["child_id"]),
                "summary": payload.follow_up.summary,
                "next_steps": payload.follow_up.next_steps,
                "objectives": json.dumps(
                    [objective.model_dump() for objective in payload.follow_up.objectives]
                ),
                "next_objectives": json.dumps(
                    [objective.model_dump() for objective in payload.follow_up.next_objectives]
                ),
                "tags": payload.follow_up.tags,
                "attention_points": payload.follow_up.attention_points,
            },
        )
        .mappings()
        .first()
    )
    if not follow_up:
        raise BookingValidationError("Could not save follow-up.")

    updated_booking = (
        db.execute(
            text(
                """
                update bookings
                set
                  status = case when status = 'confirmada' then 'concluida' else status end,
                  updated_at = now()
                where id = :booking_id
                returning id, status
                """
            ),
            {"booking_id": str(booking_id)},
        )
        .mappings()
        .first()
    )
    if not updated_booking:
        raise BookingNotFoundError("Booking not found.")

    return {
        "status": "ok",
        "booking_id": updated_booking["id"],
        "booking_status": updated_booking["status"],
        "latest_follow_up": {
            "updated_at": follow_up["updated_at"],
            "summary": follow_up["summary"],
            "next_steps": follow_up["next_steps"],
            "objectives": _normalize_objectives(follow_up.get("objectives")),
            "next_objectives": _normalize_objectives(follow_up.get("next_objectives")),
            "tags": list(follow_up["tags"] or []),
            "attention_points": list(follow_up["attention_points"] or []),
        },
    }


def get_teacher_follow_up_context(db: Session, user: AuthUser, booking_id: UUID) -> dict:
    _ensure_teacher_role(db, user.user_id)

    booking_row = (
        db.execute(
            text(
                """
                select
                  b.id,
                  b.teacher_profile_id,
                  b.child_id,
                  b.date_iso,
                  b.time,
                  b.duration_minutes,
                  b.modality,
                  b.status,
                  pc.name as child_name,
                  pc.age as child_age,
                  pc.focus_points as child_focus_points
                from bookings b
                join parent_children pc on pc.id = b.child_id
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
    if str(booking_row["teacher_profile_id"]) != user.user_id:
        raise BookingPermissionError("Only the teacher owner can access follow-up context.")

    completed_lessons_with_child = db.execute(
        text(
            """
            select count(*)
            from bookings b
            where b.teacher_profile_id = :teacher_profile_id
              and b.child_id = :child_id
              and b.status = 'concluida'
              and (
                b.date_iso < :target_date
                or (b.date_iso = :target_date and b.time < :target_time)
              )
            """
        ),
        {
            "teacher_profile_id": user.user_id,
            "child_id": str(booking_row["child_id"]),
            "target_date": booking_row["date_iso"],
            "target_time": booking_row["time"],
        },
    ).scalar()
    completed_lessons_with_child = int(completed_lessons_with_child or 0)
    is_first_lesson_with_child = completed_lessons_with_child == 0

    latest_previous_follow_up = (
        db.execute(
            text(
                """
                select
                  bf.summary,
                  bf.objectives,
                  bf.next_objectives
                from booking_follow_ups bf
                join bookings b_follow_up on b_follow_up.id = bf.booking_id
                where bf.teacher_profile_id = :teacher_profile_id
                  and bf.child_id = :child_id
                  and (
                    b_follow_up.date_iso < :target_date
                    or (b_follow_up.date_iso = :target_date and b_follow_up.time < :target_time)
                  )
                order by b_follow_up.date_iso desc, b_follow_up.time desc, bf.updated_at desc
                limit 1
                """
            ),
            {
                "teacher_profile_id": user.user_id,
                "child_id": str(booking_row["child_id"]),
                "target_date": booking_row["date_iso"],
                "target_time": booking_row["time"],
            },
        )
        .mappings()
        .first()
    )

    if is_first_lesson_with_child:
        class_objectives = [
            {
                "objective": "Diagnóstico",
                "achieved": False,
                "fullfilment_level": 0,
            },
        ]
    else:
        previous_next_objectives = _normalize_objectives(
            latest_previous_follow_up.get("next_objectives") if latest_previous_follow_up else None
        )
        previous_objectives = _normalize_objectives(
            latest_previous_follow_up.get("objectives") if latest_previous_follow_up else None
        )
        class_objectives = previous_next_objectives or previous_objectives
        if not class_objectives:
            class_objectives = [
                {
                    "objective": "Consolidar objetivo pedagógico principal do ciclo atual",
                    "achieved": False,
                    "fullfilment_level": 0,
                }
            ]

    parent_focus_points = (
        _parse_focus_points(booking_row.get("child_focus_points"))
        if is_first_lesson_with_child
        else []
    )
    activity_plan = generate_teacher_activity_plan(
        TeacherActivityPlanInput(
            child_name=str(booking_row.get("child_name") or "Aluno"),
            child_age=int(booking_row["child_age"]) if booking_row.get("child_age") is not None else None,
            completed_lessons_with_child=completed_lessons_with_child,
            objectives=[objective["objective"] for objective in class_objectives],
            parent_focus_points=parent_focus_points,
            latest_follow_up_summary=(
                latest_previous_follow_up.get("summary") if latest_previous_follow_up else None
            ),
        )
    )

    return {
        "booking_id": booking_row["id"],
        "child_id": booking_row["child_id"],
        "child_name": booking_row["child_name"] or "Aluno",
        "child_age": booking_row["child_age"],
        "date_iso": booking_row["date_iso"],
        "date_label": _format_date_label(booking_row["date_iso"]),
        "time": booking_row["time"],
        "duration_minutes": booking_row["duration_minutes"],
        "modality": booking_row["modality"],
        "status": booking_row["status"],
        "completed_lessons_with_child": completed_lessons_with_child,
        "class_objectives": class_objectives,
        "parent_focus_points": parent_focus_points,
        "activity_plan_source": activity_plan["source"],
        "activity_plan": activity_plan["activities"],
    }


def get_teacher_availability_slots(
    db: Session,
    teacher_profile_id: UUID,
    date_from: date,
    date_to: date,
    duration_minutes: int,
) -> dict:
    if duration_minutes <= 0:
        raise BookingValidationError("duration_minutes must be greater than zero.")
    if date_to < date_from:
        raise BookingValidationError("to date must be greater than or equal to from date.")

    _ensure_teacher_exists(db, teacher_profile_id)

    schedule_rows = (
        db.execute(
            text(
                """
                select day_of_week, start_time, end_time
                from teacher_availability
                where profile_id = :profile_id
                order by day_of_week asc, start_time asc
                """
            ),
            {"profile_id": str(teacher_profile_id)},
        )
        .mappings()
        .all()
    )

    booked_rows = (
        db.execute(
            text(
                """
                select date_iso, time
                from bookings
                where teacher_profile_id = :teacher_profile_id
                  and date_iso between :date_from and :date_to
                  and status in ('pendente', 'confirmada')
                """
            ),
            {
                "teacher_profile_id": str(teacher_profile_id),
                "date_from": date_from,
                "date_to": date_to,
            },
        )
        .mappings()
        .all()
    )

    booked_by_date: dict[date, set[str]] = {}
    for row in booked_rows:
        booked_by_date.setdefault(row["date_iso"], set()).add(str(row["time"]))

    rows_by_day: dict[int, list[dict]] = {}
    for row in schedule_rows:
        rows_by_day.setdefault(int(row["day_of_week"]), []).append(dict(row))

    slots = []
    current_date = date_from
    while current_date <= date_to:
        day_rows = rows_by_day.get(current_date.weekday(), [])
        available_times: list[str] = []
        blocked_times = booked_by_date.get(current_date, set())

        for schedule in day_rows:
            start_minutes = _time_to_minutes(schedule["start_time"])
            end_minutes = _time_to_minutes(schedule["end_time"])
            minute = start_minutes
            while minute + duration_minutes <= end_minutes:
                time_value = _minutes_to_time(minute)
                if time_value not in blocked_times:
                    available_times.append(time_value)
                minute += duration_minutes

        if available_times:
            slots.append(
                {
                    "date_iso": current_date,
                    "date_label": _format_date_label(current_date),
                    "times": sorted(set(available_times)),
                }
            )

        current_date += timedelta(days=1)

    return {"teacher_profile_id": teacher_profile_id, "slots": slots}
