from datetime import UTC, date, datetime, timedelta
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


def get_teacher_control_center_overview(
    db: Session,
    user: AuthUser,
    *,
    limit_agenda: int = 8,
    limit_chats: int = 8,
    limit_students: int = 8,
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
                  b.date_iso,
                  b.time,
                  b.duration_minutes,
                  b.modality,
                  b.status,
                  ct.id as chat_thread_id
                from bookings b
                join parent_children pc on pc.id = b.child_id
                left join chat_threads ct on ct.booking_id = b.id
                where b.teacher_profile_id = :teacher_profile_id
                  and b.date_iso >= current_date
                order by b.date_iso asc, b.time asc
                limit :limit_agenda
                """
            ),
            {
                "teacher_profile_id": user.user_id,
                "limit_agenda": limit_agenda,
            },
        )
        .mappings()
        .all()
    )

    agenda_payload = []
    for row in agenda_rows:
        status = str(row["status"])
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
                "actions": {
                    "can_accept": status == "pendente",
                    "can_reject": status in ("pendente", "confirmada"),
                    "can_reschedule": status in ("pendente", "confirmada"),
                    "can_open_chat": True,
                    "can_complete": status == "confirmada",
                },
            }
        )

    chat_rows = (
        db.execute(
            text(
                """
                select
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
                order by coalesce(ct.last_message_at, ct.updated_at) desc
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
