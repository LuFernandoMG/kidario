from datetime import UTC, date, datetime, timedelta
import json
import re
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.security import AuthUser
from app.schemas.v2_teacher_control import TeacherControlCenterOverviewResponse, TeacherStudentTimelineResponse
from app.services.booking_v2_service import BookingNotFoundError, BookingValidationError, get_teacher_availability_slots_v2
from app.services.identity_service import IdentityNotFoundError, IdentityPermissionError, require_user_role, resolve_teacher_id
from app.services.teacher_activity_planner_service import get_cached_teacher_activity_plan_for_booking


class TeacherControlPermissionError(Exception):
    pass


class TeacherStudentNotFoundError(Exception):
    pass


def _require_teacher(db: Session, user: AuthUser) -> UUID:
    try:
        require_user_role(db, user.user_id, "teacher")
        return resolve_teacher_id(db, user.user_id)
    except (IdentityNotFoundError, IdentityPermissionError) as exc:
        raise TeacherControlPermissionError("Only teacher users can perform this action.") from exc


def _resolve_progress_status(completed_lessons: int, latest_follow_up_summary: str | None) -> str:
    if completed_lessons <= 0:
        return "sem_dados"
    if completed_lessons >= 3 and latest_follow_up_summary:
        return "consistente"
    return "atencao"


def _can_teacher_complete_booking(*, status: str, starts_at: datetime, duration_minutes: int) -> bool:
    if status == "concluida":
        return True
    if status != "confirmada":
        return False
    lesson_end = starts_at + timedelta(minutes=int(duration_minutes or 0))
    now_value = datetime.now(starts_at.tzinfo) if starts_at.tzinfo else datetime.now()
    return lesson_end <= now_value


def _normalize_objectives(raw_value: object) -> list[dict]:
    if raw_value is None:
        return []
    parsed_value = raw_value
    if isinstance(raw_value, str):
        try:
            parsed_value = json.loads(raw_value)
        except json.JSONDecodeError:
            parsed_value = [raw_value]
    if not isinstance(parsed_value, (list, tuple, set)):
        parsed_value = [parsed_value]

    normalized: list[dict] = []
    for value in parsed_value:
        if isinstance(value, str):
            objective_text = value.strip()
            if objective_text:
                normalized.append({"objective": objective_text, "achieved": False, "fullfilment_level": 0})
            continue
        if not isinstance(value, dict):
            continue
        objective_text = str(value.get("objective", "")).strip()
        if not objective_text:
            continue
        level_raw = value.get("fullfilment_level", value.get("fulfilment_level"))
        level = level_raw if isinstance(level_raw, int) and 0 <= level_raw <= 5 else 0
        normalized.append(
            {"objective": objective_text, "achieved": bool(value.get("achieved", False)), "fullfilment_level": level}
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
    return [chunk.strip(" -\t") for chunk in chunks if chunk.strip(" -\t")]


def _build_lesson_objectives(
    *,
    is_first_lesson_with_child: bool,
    latest_follow_up_next_objectives: object,
    latest_follow_up_objectives: object,
) -> list[dict]:
    if is_first_lesson_with_child:
        return [{"objective": "Diagnóstico", "achieved": False, "fullfilment_level": 0}]
    objectives = _normalize_objectives(latest_follow_up_next_objectives) or _normalize_objectives(latest_follow_up_objectives)
    return objectives or [
        {"objective": "Consolidar habilidades trabalhadas na aula anterior", "achieved": False, "fullfilment_level": 0},
        {"objective": "Aprofundar objetivo principal do ciclo atual", "achieved": False, "fullfilment_level": 0},
        {"objective": "Definir meta clara para o próximo encontro", "achieved": False, "fullfilment_level": 0},
    ]


def _build_recent_objectives(*, follow_up_next_objectives: object, follow_up_objectives: object) -> list[dict]:
    return _normalize_objectives(follow_up_next_objectives) or _normalize_objectives(follow_up_objectives)


def get_teacher_control_center_overview(
    db: Session,
    user: AuthUser,
    *,
    limit_agenda: int = 8,
    limit_chats: int = 8,
    limit_students: int = 8,
    include_history: bool = False,
) -> dict:
    teacher_id = _require_teacher(db, user)
    today = date.today()
    window_end = today + timedelta(days=14)

    counts_row = (
        db.execute(
            text(
                """
                select
                  count(*) filter (
                    where starts_at >= now()
                      and status in ('pendente', 'confirmada')
                      and coalesce(teacher_decision_status, 'pending') <> 'rejected'
                  ) as upcoming_lessons_count,
                  count(*) filter (
                    where starts_at >= now()
                      and status = 'pendente'
                      and coalesce(teacher_decision_status, 'pending') = 'pending'
                  ) as pending_decisions_count
                from bookings
                where teacher_id = :teacher_id
                """
            ),
            {"teacher_id": str(teacher_id)},
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
                  b.parent_id,
                  p.user_id as parent_user_id,
                  c.name as child_name,
                  c.focus_points as child_focus_points,
                  b.starts_at,
                  b.duration_minutes,
                  b.modality,
                  b.status,
                  coalesce(b.teacher_decision_status, 'pending') as teacher_decision_status,
                  b.teacher_decision_reason,
                  b.teacher_decision_at,
                  coalesce(b.payment_flow_status, 'not_started') as payment_flow_status,
                  ct.id as chat_thread_id,
                  coalesce(completed_counter.completed_lessons_with_child, 0) as completed_lessons_with_child,
                  latest_follow_up.summary as latest_follow_up_summary,
                  latest_follow_up.next_objectives as latest_follow_up_next_objectives,
                  latest_follow_up.objectives as latest_follow_up_objectives,
                  last_message.sender_user_id as last_message_sender_user_id
                from bookings b
                join parents p on p.id = b.parent_id
                join children c on c.id = b.child_id
                left join lateral (
                  select t.id
                  from chat_threads t
                  where t.parent_id = b.parent_id
                    and t.teacher_id = b.teacher_id
                    and t.child_id = b.child_id
                  order by coalesce(t.last_message_at, t.updated_at) desc, t.created_at asc
                  limit 1
                ) ct on true
                left join lateral (
                  select count(*)::int as completed_lessons_with_child
                  from bookings b_completed
                  where b_completed.teacher_id = b.teacher_id
                    and b_completed.child_id = b.child_id
                    and b_completed.status = 'concluida'
                    and b_completed.starts_at < b.starts_at
                ) completed_counter on true
                left join lateral (
                  select bf.summary, bf.next_objectives, bf.objectives
                  from booking_follow_ups bf
                  join bookings b_follow_up on b_follow_up.id = bf.booking_id
                  where b_follow_up.teacher_id = b.teacher_id
                    and b_follow_up.child_id = b.child_id
                    and b_follow_up.starts_at < b.starts_at
                  order by b_follow_up.starts_at desc, bf.updated_at desc
                  limit 1
                ) latest_follow_up on true
                left join lateral (
                  select cm.sender_user_id
                  from chat_messages cm
                  where cm.thread_id = ct.id
                  order by cm.created_at desc
                  limit 1
                ) last_message on true
                where b.teacher_id = :teacher_id
                  and (:include_history = true or b.starts_at >= now())
                order by b.starts_at asc
                limit :limit_agenda
                """
            ),
            {"teacher_id": str(teacher_id), "limit_agenda": limit_agenda, "include_history": include_history},
        )
        .mappings()
        .all()
    )

    agenda_payload = []
    for row in agenda_rows:
        status = str(row["status"])
        teacher_decision_status = str(row.get("teacher_decision_status") or "pending")
        completed_lessons_with_child = int(row.get("completed_lessons_with_child") or 0)
        is_first_lesson_with_child = completed_lessons_with_child == 0
        parent_focus_points = _parse_focus_points(row.get("child_focus_points")) if is_first_lesson_with_child else []
        objectives = _build_lesson_objectives(
            is_first_lesson_with_child=is_first_lesson_with_child,
            latest_follow_up_next_objectives=row.get("latest_follow_up_next_objectives"),
            latest_follow_up_objectives=row.get("latest_follow_up_objectives"),
        )
        cached_activity_plan = get_cached_teacher_activity_plan_for_booking(db=db, booking_id=str(row["id"]))
        activity_plan = cached_activity_plan or {"source": "fallback", "activities": []}
        has_unread_messages = (
            bool(row.get("chat_thread_id"))
            and row.get("last_message_sender_user_id") is not None
            and str(row["last_message_sender_user_id"]) == str(row["parent_user_id"])
        )
        agenda_payload.append(
            {
                "id": row["id"],
                "child_id": row["child_id"],
                "child_name": row["child_name"] or "Aluno",
                "parent_id": row["parent_id"],
                "starts_at": row["starts_at"],
                "duration_minutes": row["duration_minutes"],
                "modality": row["modality"],
                "status": status,
                "teacher_decision_status": teacher_decision_status,
                "teacher_decision_reason": row.get("teacher_decision_reason"),
                "teacher_decision_at": row.get("teacher_decision_at"),
                "payment_flow_status": row.get("payment_flow_status") or "not_started",
                "chat_thread_id": row["chat_thread_id"],
                "has_unread_messages": has_unread_messages,
                "completed_lessons_with_child": completed_lessons_with_child,
                "objectives": objectives,
                "parent_focus_points": parent_focus_points,
                "activity_plan_source": activity_plan["source"],
                "activity_plan": activity_plan["activities"],
                "actions": {
                    "can_accept": status == "pendente" and teacher_decision_status == "pending",
                    "can_reject": status == "pendente" and teacher_decision_status == "pending",
                    "can_reschedule": status in ("pendente", "confirmada"),
                    "can_open_chat": True,
                    "can_complete": _can_teacher_complete_booking(
                        status=status,
                        starts_at=row["starts_at"],
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
                  select distinct on (ct.parent_id, ct.teacher_id, ct.child_id)
                    ct.id as thread_id,
                    ct.booking_id,
                    b.status as booking_status,
                    coalesce(b.teacher_decision_status, 'pending') as teacher_decision_status,
                    coalesce(b.payment_flow_status, 'not_started') as payment_flow_status,
                    c.name as child_name,
                    b.starts_at as lesson_starts_at,
                    u_parent.first_name as parent_first_name,
                    u_parent.last_name as parent_last_name,
                    ct.last_message_at,
                    ct.updated_at
                  from chat_threads ct
                  join bookings b on b.id = ct.booking_id
                  join children c on c.id = ct.child_id
                  join parents p on p.id = ct.parent_id
                  join users u_parent on u_parent.id = p.user_id
                  where ct.teacher_id = :teacher_id
                    and b.starts_at >= now() - interval '30 days'
                  order by
                    ct.parent_id,
                    ct.teacher_id,
                    ct.child_id,
                    coalesce(ct.last_message_at, ct.updated_at) desc,
                    ct.created_at asc
                ) dedup_threads
                order by coalesce(dedup_threads.last_message_at, dedup_threads.updated_at) desc
                limit :limit_chats
                """
            ),
            {"teacher_id": str(teacher_id), "limit_chats": limit_chats},
        )
        .mappings()
        .all()
    )
    chat_payload = [
        {
            "thread_id": row["thread_id"],
            "booking_id": row["booking_id"],
            "booking_status": row["booking_status"],
            "teacher_decision_status": row.get("teacher_decision_status") or "pending",
            "payment_flow_status": row.get("payment_flow_status") or "not_started",
            "child_name": row["child_name"] or "Aluno",
            "parent_name": " ".join(
                part for part in [row.get("parent_first_name"), row.get("parent_last_name")] if part
            ).strip()
            or "Responsável",
            "lesson_starts_at": row["lesson_starts_at"],
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
                  select distinct b.child_id, c.name as child_name, c.birth_month_year as child_birth_month_year
                  from bookings b
                  join children c on c.id = b.child_id
                  where b.teacher_id = :teacher_id
                ),
                aggregated as (
                  select
                    b.child_id,
                    count(*) as total_lessons,
                    count(*) filter (where b.status = 'concluida') as completed_lessons,
                    max(b.starts_at) as latest_lesson_at
                  from bookings b
                  where b.teacher_id = :teacher_id
                  group by b.child_id
                ),
                latest_follow_up as (
                  select distinct on (b.child_id)
                    b.child_id,
                    bf.summary
                  from booking_follow_ups bf
                  join bookings b on b.id = bf.booking_id
                  where b.teacher_id = :teacher_id
                  order by b.child_id, bf.updated_at desc
                )
                select
                  tc.child_id,
                  tc.child_name,
                  tc.child_birth_month_year,
                  ag.total_lessons,
                  ag.completed_lessons,
                  ag.latest_lesson_at,
                  lf.summary as latest_follow_up_summary
                from teacher_children tc
                join aggregated ag on ag.child_id = tc.child_id
                left join latest_follow_up lf on lf.child_id = tc.child_id
                order by ag.latest_lesson_at desc nulls last, tc.child_name asc
                limit :limit_students
                """
            ),
            {"teacher_id": str(teacher_id), "limit_students": limit_students},
        )
        .mappings()
        .all()
    )
    students_payload = [
        {
            "child_id": row["child_id"],
            "child_name": row["child_name"] or "Aluno",
            "child_birth_month_year": row["child_birth_month_year"],
            "total_lessons": int(row["total_lessons"] or 0),
            "completed_lessons": int(row["completed_lessons"] or 0),
            "latest_lesson_at": row["latest_lesson_at"],
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
                  coalesce(sum(case when b.status = 'concluida' then coalesce(ps.amount_cents, round(po.amount_cents * coalesce(ps.percentage, 0) / 100)::integer, 0) else 0 end), 0) as gross_revenue_total_cents,
                  coalesce(sum(case when po.status = 'paid' and b.status in ('confirmada', 'concluida') then coalesce(ps.amount_cents, round(po.amount_cents * coalesce(ps.percentage, 0) / 100)::integer, 0) else 0 end), 0) as paid_total_cents,
                  coalesce(sum(case when po.status in ('created', 'pending', 'authorized') and b.status in ('pendente', 'confirmada', 'concluida') then coalesce(ps.amount_cents, round(po.amount_cents * coalesce(ps.percentage, 0) / 100)::integer, 0) else 0 end), 0) as pending_payment_total_cents,
                  count(*) filter (where b.status = 'concluida') as completed_lessons_count,
                  count(*) filter (where po.status = 'paid' and b.status in ('confirmada', 'concluida')) as paid_lessons_count
                from bookings b
                left join payment_orders po on po.booking_id = b.id
                left join payment_splits ps on ps.payment_order_id = po.id and ps.split_role = 'teacher'
                where b.teacher_id = :teacher_id
                """
            ),
            {"teacher_id": str(teacher_id)},
        )
        .mappings()
        .first()
    )

    lesson_duration_minutes = db.execute(
        text("select coalesce(lesson_duration_minutes, 60) from teachers where id = :teacher_id"),
        {"teacher_id": str(teacher_id)},
    ).scalar()
    try:
        availability = get_teacher_availability_slots_v2(
            db,
            teacher_id,
            date_from=today,
            date_to=window_end,
            duration_minutes=int(lesson_duration_minutes or 60),
        )
        available_slots_count = sum(len(day["starts_at"]) for day in availability["slots"])
    except (BookingValidationError, BookingNotFoundError):
        available_slots_count = 0

    upcoming_lessons_window_count = db.execute(
        text(
            """
            select count(*)
            from bookings
            where teacher_id = :teacher_id
              and starts_at >= :window_start
              and starts_at < :window_end
              and status in ('pendente', 'confirmada')
              and coalesce(teacher_decision_status, 'pending') <> 'rejected'
            """
        ),
        {
            "teacher_id": str(teacher_id),
            "window_start": datetime.combine(today, datetime.min.time()),
            "window_end": datetime.combine(window_end + timedelta(days=1), datetime.min.time()),
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
            "gross_revenue_total_cents": int((finance_row or {}).get("gross_revenue_total_cents", 0) or 0),
            "paid_total_cents": int((finance_row or {}).get("paid_total_cents", 0) or 0),
            "pending_payment_total_cents": int((finance_row or {}).get("pending_payment_total_cents", 0) or 0),
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


def get_teacher_student_timeline(
    db: Session,
    user: AuthUser,
    *,
    child_id: UUID,
    limit: int = 50,
) -> dict:
    teacher_id = _require_teacher(db, user)
    child_row = (
        db.execute(
            text(
                """
                select c.id, c.name
                from children c
                join bookings b on b.child_id = c.id
                where c.id = :child_id
                  and b.teacher_id = :teacher_id
                limit 1
                """
            ),
            {"child_id": str(child_id), "teacher_id": str(teacher_id)},
        )
        .mappings()
        .first()
    )
    if not child_row:
        raise TeacherStudentNotFoundError("Student not found for this teacher.")

    timeline_rows = (
        db.execute(
            text(
                """
                select
                  b.id as booking_id,
                  b.child_id,
                  coalesce(c.name, :fallback_child_name) as child_name,
                  b.starts_at,
                  bf.updated_at as follow_up_updated_at,
                  bf.summary,
                  bf.next_steps,
                  bf.next_objectives,
                  bf.objectives,
                  bf.tags,
                  bf.attention_points
                from bookings b
                join children c on c.id = b.child_id
                left join booking_follow_ups bf on bf.booking_id = b.id
                where b.teacher_id = :teacher_id
                  and b.child_id = :child_id
                  and b.status = 'concluida'
                order by b.starts_at desc, coalesce(bf.updated_at, b.updated_at) desc
                limit :limit_rows
                """
            ),
            {
                "teacher_id": str(teacher_id),
                "child_id": str(child_id),
                "limit_rows": int(limit),
                "fallback_child_name": "Aluno",
            },
        )
        .mappings()
        .all()
    )

    timeline_payload = []
    for row in timeline_rows:
        recent_objectives = _build_recent_objectives(
            follow_up_next_objectives=row.get("next_objectives"),
            follow_up_objectives=row.get("objectives"),
        )
        has_follow_up = bool(
            (row.get("summary") or "").strip()
            or (row.get("next_steps") or "").strip()
            or recent_objectives
            or list(row.get("tags") or [])
            or list(row.get("attention_points") or [])
        )
        follow_up_payload = None
        if has_follow_up and row.get("follow_up_updated_at") is not None:
            follow_up_payload = {
                "updated_at": row["follow_up_updated_at"],
                "summary": row.get("summary") or "",
                "next_steps": row.get("next_steps") or "",
                "objectives": _normalize_objectives(row.get("objectives")),
                "next_objectives": _normalize_objectives(row.get("next_objectives")),
                "tags": list(row.get("tags") or []),
                "attention_points": list(row.get("attention_points") or []),
            }
        timeline_payload.append(
            {
                "booking_id": row["booking_id"],
                "child_id": row["child_id"],
                "child_name": row["child_name"] or "Aluno",
                "starts_at": row["starts_at"],
                "summary": row["summary"],
                "recent_objectives": recent_objectives,
                "has_follow_up": has_follow_up,
                "follow_up": follow_up_payload,
            }
        )

    payload = {
        "child_id": child_row["id"],
        "child_name": child_row["name"] or "Aluno",
        "total_completed_lessons": len(timeline_payload),
        "timeline": timeline_payload,
    }
    return TeacherStudentTimelineResponse(**payload).model_dump()
