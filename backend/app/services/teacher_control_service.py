from datetime import UTC, date, datetime, timedelta
import re
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.security import AuthUser
from app.schemas.teacher_control import TeacherControlCenterOverviewResponse
from app.services.booking_service import (
    BookingNotFoundError,
    BookingValidationError,
    get_teacher_availability_slots,
)
from app.services.teacher_activity_planner_service import get_cached_teacher_activity_plan_for_booking


class TeacherControlPermissionError(Exception):
    pass


def _format_date_label(date_value: date) -> str:
    return date_value.strftime("%d/%m/%Y")


def _full_name(first_name: str | None, last_name: str | None) -> str:
    normalized = " ".join(part for part in [first_name or "", last_name or ""] if part.strip()).strip()
    return normalized or "Responsável"


def _ensure_teacher_role(db: Session, profile_id: str) -> None:
    role = db.execute(text("select role from profiles where id = :profile_id"), {"profile_id": profile_id}).scalar()
    if role != "teacher":
        raise TeacherControlPermissionError("Only teacher users can perform this action.")


def _resolve_progress_status(completed_lessons: int, latest_follow_up_summary: str | None) -> str:
    if completed_lessons <= 0:
        return "sem_dados"
    if completed_lessons >= 3 and latest_follow_up_summary:
        return "consistente"
    return "atencao"


def _can_teacher_complete_booking(*, status: str, date_iso: date, time_value: str, duration_minutes: int) -> bool:
    if status == "concluida":
        return True
    if status != "confirmada":
        return False

    hour, minute = time_value.split(":", maxsplit=1)
    lesson_start = datetime(
        year=date_iso.year,
        month=date_iso.month,
        day=date_iso.day,
        hour=int(hour),
        minute=int(minute),
    )
    lesson_end = lesson_start + timedelta(minutes=int(duration_minutes or 0))
    return lesson_end <= datetime.now()


def _normalize_objectives(raw_value: object) -> list[dict]:
    if raw_value is None:
        return []

    if isinstance(raw_value, str):
        values: list[object] = [raw_value]
    elif isinstance(raw_value, (list, tuple, set)):
        values = list(raw_value)
    else:
        values = [raw_value]

    normalized: list[dict] = []
    for value in values:
        if isinstance(value, str):
            objective_text = value.strip()
            if not objective_text:
                continue
            normalized.append(
                {
                    "objective": objective_text,
                    "achieved": False,
                    "fullfilment_level": 0,
                }
            )
            continue

        if not isinstance(value, dict):
            continue

        objective_text = str(value.get("objective", "")).strip()
        if not objective_text:
            continue

        fullfilment_level_raw = value.get("fullfilment_level", value.get("fulfilment_level"))
        fullfilment_level: int
        if isinstance(fullfilment_level_raw, int) and 0 <= fullfilment_level_raw <= 5:
            fullfilment_level = fullfilment_level_raw
        else:
            fullfilment_level = 0

        normalized.append(
            {
                "objective": objective_text,
                "achieved": bool(value.get("achieved", False)),
                "fullfilment_level": fullfilment_level,
            }
        )

    return normalized


def _parse_focus_points(raw_focus_points: str | None) -> list[str]:
    if not raw_focus_points:
        return []
    normalized = raw_focus_points.strip()
    if not normalized:
        return []

    if "\n" in normalized or ";" in normalized or "•" in normalized:
        chunks = re.split(r"[\n;•]+", normalized)
    elif "," in normalized:
        chunks = normalized.split(",")
    else:
        chunks = [normalized]

    output: list[str] = []
    for chunk in chunks:
        cleaned = chunk.strip(" -\t")
        if cleaned:
            output.append(cleaned)
    return output


def _build_lesson_objectives(
    *,
    is_first_lesson_with_child: bool,
    latest_follow_up_next_objectives: object,
    latest_follow_up_objectives: object,
) -> list[dict]:
    if is_first_lesson_with_child:
        return [
            {
                "objective": "Diagnóstico",
                "achieved": False,
                "fullfilment_level": 0,
            },
        ]

    normalized_follow_up_objectives = _normalize_objectives(latest_follow_up_next_objectives)
    if normalized_follow_up_objectives:
        return normalized_follow_up_objectives

    normalized_follow_up_objectives = _normalize_objectives(latest_follow_up_objectives)
    if normalized_follow_up_objectives:
        return normalized_follow_up_objectives

    return [
        {
            "objective": "Consolidar habilidades trabalhadas na aula anterior",
            "achieved": False,
            "fullfilment_level": 0,
        },
        {
            "objective": "Aprofundar objetivo principal do ciclo atual",
            "achieved": False,
            "fullfilment_level": 0,
        },
        {
            "objective": "Definir meta clara para o próximo encontro",
            "achieved": False,
            "fullfilment_level": 0,
        },
    ]


def get_teacher_control_center_overview(
    db: Session,
    user: AuthUser,
    *,
    limit_agenda: int = 8,
    limit_chats: int = 8,
    limit_students: int = 8,
    include_history: bool = False,
) -> dict:
    _ensure_teacher_role(db, user.user_id)
    today = date.today()
    window_end = today + timedelta(days=14)
    teacher_uuid = UUID(user.user_id)

    counts_row = (
        db.execute(
            text(
                """
                select
                  count(*) filter (
                    where date_iso >= current_date and status in ('pendente', 'confirmada')
                  ) as upcoming_lessons_count,
                  count(*) filter (
                    where date_iso >= current_date and status = 'pendente'
                  ) as pending_decisions_count
                from bookings
                where teacher_profile_id = :teacher_profile_id
                """
            ),
            {"teacher_profile_id": user.user_id},
        )
        .mappings()
        .first()
    )

    agenda_rows = (
        db.execute(
            text(
                """
                select
                  b.id,
                  b.child_id,
                  b.parent_profile_id,
                  pc.name as child_name,
                  pc.age as child_age,
                  pc.focus_points as child_focus_points,
                  b.date_iso,
                  b.time,
                  b.duration_minutes,
                  b.modality,
                  b.status,
                  ct.id as chat_thread_id,
                  coalesce(completed_counter.completed_lessons_with_child, 0) as completed_lessons_with_child,
                  latest_follow_up.summary as latest_follow_up_summary,
                  latest_follow_up.next_objectives as latest_follow_up_next_objectives,
                  latest_follow_up.objectives as latest_follow_up_objectives,
                  last_message.sender_profile_id as last_message_sender_profile_id
                from bookings b
                join parent_children pc on pc.id = b.child_id
                left join lateral (
                  select
                    t.id
                  from chat_threads t
                  where t.parent_profile_id = b.parent_profile_id
                    and t.teacher_profile_id = b.teacher_profile_id
                    and t.child_id = b.child_id
                  order by coalesce(t.last_message_at, t.updated_at) desc, t.created_at asc
                  limit 1
                ) ct on true
                left join lateral (
                  select
                    count(*)::int as completed_lessons_with_child
                  from bookings b_completed
                  where b_completed.teacher_profile_id = b.teacher_profile_id
                    and b_completed.child_id = b.child_id
                    and b_completed.status = 'concluida'
                    and (
                      b_completed.date_iso < b.date_iso
                      or (b_completed.date_iso = b.date_iso and b_completed.time < b.time)
                    )
                ) completed_counter on true
                left join lateral (
                  select
                    bf.summary,
                    bf.next_objectives,
                    bf.objectives
                  from booking_follow_ups bf
                  join bookings b_follow_up on b_follow_up.id = bf.booking_id
                  where bf.teacher_profile_id = b.teacher_profile_id
                    and bf.child_id = b.child_id
                    and (
                      b_follow_up.date_iso < b.date_iso
                      or (b_follow_up.date_iso = b.date_iso and b_follow_up.time < b.time)
                    )
                  order by b_follow_up.date_iso desc, b_follow_up.time desc, bf.updated_at desc
                  limit 1
                ) latest_follow_up on true
                left join lateral (
                  select
                    cm.sender_profile_id
                  from chat_messages cm
                  where cm.thread_id = ct.id
                  order by cm.created_at desc
                  limit 1
                ) last_message on true
                where b.teacher_profile_id = :teacher_profile_id
                  and (:include_history = true or b.date_iso >= current_date)
                order by b.date_iso asc, b.time asc
                limit :limit_agenda
                """
            ),
            {
                "teacher_profile_id": user.user_id,
                "limit_agenda": limit_agenda,
                "include_history": include_history,
            },
        )
        .mappings()
        .all()
    )

    agenda_payload = []
    for row in agenda_rows:
        status = str(row["status"])
        completed_lessons_with_child = int(row.get("completed_lessons_with_child") or 0)
        is_first_lesson_with_child = completed_lessons_with_child == 0
        parent_focus_points = (
            _parse_focus_points(row.get("child_focus_points")) if is_first_lesson_with_child else []
        )
        objectives = _build_lesson_objectives(
            is_first_lesson_with_child=is_first_lesson_with_child,
            latest_follow_up_next_objectives=row.get("latest_follow_up_next_objectives"),
            latest_follow_up_objectives=row.get("latest_follow_up_objectives"),
        )
        cached_activity_plan = get_cached_teacher_activity_plan_for_booking(
            db=db,
            booking_id=str(row["id"]),
        )
        activity_plan = cached_activity_plan or {"source": "fallback", "activities": []}
        has_unread_messages = (
            bool(row.get("chat_thread_id"))
            and row.get("last_message_sender_profile_id") is not None
            and str(row["last_message_sender_profile_id"]) == str(row["parent_profile_id"])
        )

        agenda_payload.append(
            {
                "id": row["id"],
                "child_id": row["child_id"],
                "child_name": row["child_name"] or "Aluno",
                "parent_profile_id": row["parent_profile_id"],
                "date_iso": row["date_iso"],
                "date_label": _format_date_label(row["date_iso"]),
                "time": row["time"],
                "duration_minutes": row["duration_minutes"],
                "modality": row["modality"],
                "status": status,
                "chat_thread_id": row["chat_thread_id"],
                "has_unread_messages": has_unread_messages,
                "completed_lessons_with_child": completed_lessons_with_child,
                "objectives": objectives,
                "parent_focus_points": parent_focus_points,
                "activity_plan_source": activity_plan["source"],
                "activity_plan": activity_plan["activities"],
                "actions": {
                    "can_accept": status == "pendente",
                    "can_reject": status in ("pendente", "confirmada"),
                    "can_reschedule": status in ("pendente", "confirmada"),
                    "can_open_chat": True,
                    "can_complete": _can_teacher_complete_booking(
                        status=status,
                        date_iso=row["date_iso"],
                        time_value=str(row["time"]),
                        duration_minutes=int(row["duration_minutes"]),
                    ),
                },
            }
        )

    chat_rows = (
        db.execute(
            text(
                """
                select *
                from (
                  select distinct on (ct.parent_profile_id, ct.teacher_profile_id, ct.child_id)
                    ct.id as thread_id,
                    ct.booking_id,
                    b.status as booking_status,
                    pc.name as child_name,
                    b.date_iso as lesson_date_iso,
                    b.time as lesson_time,
                    p_parent.first_name as parent_first_name,
                    p_parent.last_name as parent_last_name,
                    ct.last_message_at,
                    ct.updated_at
                  from chat_threads ct
                  join bookings b on b.id = ct.booking_id
                  join parent_children pc on pc.id = ct.child_id
                  join profiles p_parent on p_parent.id = ct.parent_profile_id
                  where ct.teacher_profile_id = :teacher_profile_id
                    and b.date_iso >= current_date - interval '30 days'
                  order by
                    ct.parent_profile_id,
                    ct.teacher_profile_id,
                    ct.child_id,
                    coalesce(ct.last_message_at, ct.updated_at) desc,
                    ct.created_at asc
                ) dedup_threads
                order by coalesce(dedup_threads.last_message_at, dedup_threads.updated_at) desc
                limit :limit_chats
                """
            ),
            {"teacher_profile_id": user.user_id, "limit_chats": limit_chats},
        )
        .mappings()
        .all()
    )

    chat_payload = [
        {
            "thread_id": row["thread_id"],
            "booking_id": row["booking_id"],
            "booking_status": row["booking_status"],
            "child_name": row["child_name"] or "Aluno",
            "parent_name": _full_name(row.get("parent_first_name"), row.get("parent_last_name")),
            "lesson_date_iso": row["lesson_date_iso"],
            "lesson_time": row["lesson_time"],
            "last_message_at": row["last_message_at"],
            "updated_at": row["updated_at"],
        }
        for row in chat_rows
    ]

    student_rows = (
        db.execute(
            text(
                """
                with teacher_children as (
                  select distinct b.child_id, pc.name as child_name, pc.age as child_age
                  from bookings b
                  join parent_children pc on pc.id = b.child_id
                  where b.teacher_profile_id = :teacher_profile_id
                ),
                aggregated as (
                  select
                    b.child_id,
                    count(*) as total_lessons,
                    count(*) filter (where b.status = 'concluida') as completed_lessons,
                    max(b.date_iso) as latest_lesson_date
                  from bookings b
                  where b.teacher_profile_id = :teacher_profile_id
                  group by b.child_id
                ),
                latest_follow_up as (
                  select distinct on (bf.child_id)
                    bf.child_id,
                    bf.summary
                  from booking_follow_ups bf
                  where bf.teacher_profile_id = :teacher_profile_id
                  order by bf.child_id, bf.updated_at desc
                )
                select
                  tc.child_id,
                  tc.child_name,
                  tc.child_age,
                  ag.total_lessons,
                  ag.completed_lessons,
                  ag.latest_lesson_date,
                  lf.summary as latest_follow_up_summary
                from teacher_children tc
                join aggregated ag on ag.child_id = tc.child_id
                left join latest_follow_up lf on lf.child_id = tc.child_id
                order by ag.latest_lesson_date desc nulls last, tc.child_name asc
                limit :limit_students
                """
            ),
            {"teacher_profile_id": user.user_id, "limit_students": limit_students},
        )
        .mappings()
        .all()
    )

    students_payload = [
        {
            "child_id": row["child_id"],
            "child_name": row["child_name"] or "Aluno",
            "child_age": row["child_age"],
            "total_lessons": row["total_lessons"],
            "completed_lessons": row["completed_lessons"],
            "latest_lesson_date": row["latest_lesson_date"],
            "latest_follow_up_summary": row["latest_follow_up_summary"],
            "progress_status": _resolve_progress_status(
                int(row["completed_lessons"] or 0),
                row["latest_follow_up_summary"],
            ),
        }
        for row in student_rows
    ]

    finance_row = (
        db.execute(
            text(
                """
                select
                  coalesce(sum(case when status = 'concluida' then price_total else 0 end), 0) as gross_revenue_total,
                  coalesce(
                    sum(
                      case
                        when payment_status = 'pago' and status in ('confirmada', 'concluida')
                        then price_total
                        else 0
                      end
                    ),
                    0
                  ) as paid_total,
                  coalesce(
                    sum(
                      case
                        when payment_status = 'pendente' and status in ('confirmada', 'concluida')
                        then price_total
                        else 0
                      end
                    ),
                    0
                  ) as pending_payment_total,
                  count(*) filter (where status = 'concluida') as completed_lessons_count,
                  count(*) filter (
                    where payment_status = 'pago' and status in ('confirmada', 'concluida')
                  ) as paid_lessons_count
                from bookings
                where teacher_profile_id = :teacher_profile_id
                """
            ),
            {"teacher_profile_id": user.user_id},
        )
        .mappings()
        .first()
    )

    lesson_duration_minutes = db.execute(
        text(
            """
            select coalesce(lesson_duration_minutes, 60)
            from teacher_profiles
            where profile_id = :teacher_profile_id
            """
        ),
        {"teacher_profile_id": user.user_id},
    ).scalar()

    try:
        availability = get_teacher_availability_slots(
            db,
            teacher_uuid,
            date_from=today,
            date_to=window_end,
            duration_minutes=int(lesson_duration_minutes or 60),
        )
        available_slots_count = sum(len(day["times"]) for day in availability["slots"])
    except (BookingValidationError, BookingNotFoundError):
        available_slots_count = 0

    upcoming_lessons_window_count = db.execute(
        text(
            """
            select count(*)
            from bookings
            where teacher_profile_id = :teacher_profile_id
              and date_iso between :window_start and :window_end
              and status in ('pendente', 'confirmada')
            """
        ),
        {
            "teacher_profile_id": user.user_id,
            "window_start": today,
            "window_end": window_end,
        },
    ).scalar()

    upcoming_lessons_window_count = int(upcoming_lessons_window_count or 0)
    occupancy_rate_percent = (
        round((upcoming_lessons_window_count / available_slots_count) * 100, 2)
        if available_slots_count > 0
        else 0.0
    )

    payload = {
        "generated_at": datetime.now(UTC),
        "upcoming_lessons_count": int((counts_row or {}).get("upcoming_lessons_count", 0)),
        "pending_decisions_count": int((counts_row or {}).get("pending_decisions_count", 0)),
        "agenda": agenda_payload,
        "chat_threads": chat_payload,
        "students": students_payload,
        "finance": {
            "currency": "BRL",
            "gross_revenue_total": float((finance_row or {}).get("gross_revenue_total", 0) or 0),
            "paid_total": float((finance_row or {}).get("paid_total", 0) or 0),
            "pending_payment_total": float((finance_row or {}).get("pending_payment_total", 0) or 0),
            "completed_lessons_count": int((finance_row or {}).get("completed_lessons_count", 0) or 0),
            "paid_lessons_count": int((finance_row or {}).get("paid_lessons_count", 0) or 0),
        },
        "planning": {
            "window_start": today,
            "window_end": window_end,
            "available_slots_count": available_slots_count,
            "upcoming_lessons_count": upcoming_lessons_window_count,
            "occupancy_rate_percent": occupancy_rate_percent,
        },
    }

    return TeacherControlCenterOverviewResponse(**payload).model_dump()
