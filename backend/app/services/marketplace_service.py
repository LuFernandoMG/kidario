from datetime import date, datetime, time, timedelta
from decimal import Decimal
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy import bindparam, text
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.services.storage_url_service import resolve_teacher_profile_photo_url


class MarketplaceNotFoundError(Exception):
    pass


MIN_BOOKING_LEAD_MINUTES = 60
LOCAL_TZ = ZoneInfo("America/Sao_Paulo")


def _to_float(value: Decimal | float | int | None) -> float:
    if value is None:
        return 0.0
    return float(value)


def _time_to_minutes(value: str) -> int:
    hours_part, minutes_part = value.split(":", maxsplit=1)
    return int(hours_part) * 60 + int(minutes_part)


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


def _modality_flags(modality: str | None) -> tuple[bool, bool]:
    normalized = (modality or "online").lower().strip()
    if normalized in ("ambos", "hibrido"):
        return True, True
    if normalized == "presencial":
        return False, True
    return True, False


def _build_experience_label(experience_count: int, hide_experience: bool) -> str:
    if hide_experience:
        return "Experiencia validada pela plataforma"
    if experience_count <= 0:
        return "Experiencia em apoio pedagogico"
    if experience_count == 1:
        return "1 experiencia registrada"
    return f"{experience_count} experiencias registradas"


def _build_preview_slots(
    schedule_rows: list[dict],
    duration_minutes: int,
    booked_slots_by_date: dict[date, set[str]],
    max_days: int = 3,
) -> list[dict]:
    rows_by_day: dict[int, list[dict]] = {}
    for row in schedule_rows:
        rows_by_day.setdefault(int(row["day_of_week"]), []).append(dict(row))

    slots: list[dict] = []
    current_date = datetime.now(LOCAL_TZ).date()
    minimum_start = datetime.now(LOCAL_TZ) + timedelta(minutes=MIN_BOOKING_LEAD_MINUTES)
    scanned_days = 0
    while len(slots) < max_days and scanned_days < 21:
        day_rows = rows_by_day.get(current_date.weekday(), [])
        blocked_times = booked_slots_by_date.get(current_date, set())
        day_starts: list[datetime] = []
        for day_row in day_rows:
            start_minutes = _time_to_minutes(str(day_row["start_time"]))
            end_minutes = _time_to_minutes(str(day_row["end_time"]))
            minute = start_minutes
            while minute + duration_minutes <= end_minutes:
                time_value = _minutes_to_time(minute)
                starts_at = _build_starts_at(current_date, time_value)
                if starts_at < minimum_start:
                    minute += duration_minutes
                    continue
                if time_value not in blocked_times:
                    day_starts.append(starts_at)
                minute += duration_minutes

        unique_starts = sorted(set(day_starts))
        if unique_starts:
            slots.append({"date": current_date, "starts_at": unique_starts})

        current_date += timedelta(days=1)
        scanned_days += 1

    return slots


def _build_next_availability(schedule_rows: list[dict], duration_minutes: int, booked_slots_by_date: dict[date, set[str]]) -> datetime | None:
    preview = _build_preview_slots(schedule_rows, duration_minutes, booked_slots_by_date, max_days=1)
    if not preview:
        return None
    starts = preview[0].get("starts_at") or []
    return starts[0] if starts else None


def _load_booked_slots(db: Session, teacher_id: UUID, date_from: date, date_to: date) -> dict[date, set[str]]:
    start_bound = datetime.combine(date_from, time.min, tzinfo=LOCAL_TZ)
    end_bound = datetime.combine(date_to + timedelta(days=1), time.min, tzinfo=LOCAL_TZ)
    rows = (
        db.execute(
            text(
                """
                select starts_at
                from bookings
                where teacher_id = :teacher_id
                  and starts_at >= :start_bound
                  and starts_at < :end_bound
                  and status in ('pendente', 'confirmada')
                """
            ),
            {
                "teacher_id": str(teacher_id),
                "start_bound": start_bound,
                "end_bound": end_bound,
            },
        )
        .mappings()
        .all()
    )

    booked: dict[date, set[str]] = {}
    for row in rows:
        starts_at = row.get("starts_at")
        if not isinstance(starts_at, datetime):
            continue
        local_starts_at = starts_at.astimezone(LOCAL_TZ) if starts_at.tzinfo else starts_at.replace(tzinfo=LOCAL_TZ)
        booked.setdefault(local_starts_at.date(), set()).add(local_starts_at.strftime("%H:%M"))
    return booked


def list_marketplace_teachers(db: Session) -> dict:
    settings = get_settings()
    rows = (
        db.execute(
            text(
                """
                select
                  t.id,
                  t.user_id,
                  coalesce(nullif(trim(concat_ws(' ', u.first_name, u.last_name)), ''), 'Professora Kidario') as name,
                  t.profile_photo_file_name as avatar_url,
                  t.hourly_rate_cents,
                  t.modality,
                  t.is_active,
                  t.hide_experience,
                  t.biography,
                  coalesce(skills.skills, '{}'::text[]) as skills,
                  coalesce(exp.experience_count, 0) as experience_count,
                  coalesce(reviews.rating, 0) as rating,
                  coalesce(reviews.review_count, 0) as review_count
                from teachers t
                join users u on u.id = t.user_id
                left join lateral (
                  select array_agg(s.skill order by s.skill) as skills
                  from teacher_skills s
                  where s.teacher_id = t.id
                ) skills on true
                left join lateral (
                  select count(*)::int as experience_count
                  from teacher_experiences ex
                  where ex.teacher_id = t.id
                ) exp on true
                left join lateral (
                  select round(avg(br.rating)::numeric, 1) as rating, count(*)::int as review_count
                  from booking_reviews br
                  join bookings b on b.id = br.booking_id
                  where b.teacher_id = t.id
                    and br.is_public = true
                    and br.status = 'published'
                ) reviews on true
                where t.is_active = true
                order by name asc
                """
            )
        )
        .mappings()
        .all()
    )

    teacher_ids = [str(row["id"]) for row in rows]
    schedule_rows = []
    if teacher_ids:
        stmt = text(
            """
            select teacher_id, day_of_week, start_time, end_time
            from teacher_availability
            where teacher_id in :teacher_ids
            """
        ).bindparams(bindparam("teacher_ids", expanding=True))
        schedule_rows = db.execute(stmt, {"teacher_ids": teacher_ids}).mappings().all()

    schedules_by_teacher: dict[str, list[dict]] = {}
    for row in schedule_rows:
        schedules_by_teacher.setdefault(str(row["teacher_id"]), []).append(dict(row))

    teachers = []
    today = datetime.now(LOCAL_TZ).date()
    for row in rows:
        teacher_id = UUID(str(row["id"]))
        is_online, is_presential = _modality_flags(row["modality"])
        duration_minutes = 60
        schedule_for_teacher = schedules_by_teacher.get(str(teacher_id), [])
        booked_slots = _load_booked_slots(db, teacher_id, today, today + timedelta(days=21))
        next_availability = _build_next_availability(schedule_for_teacher, duration_minutes, booked_slots)

        teachers.append(
            {
                "id": teacher_id,
                "user_id": row["user_id"],
                "name": row["name"],
                "avatar_url": resolve_teacher_profile_photo_url(settings, row["avatar_url"]),
                "rating": _to_float(row["rating"]),
                "review_count": int(row["review_count"] or 0),
                "price_per_class_cents": int(row["hourly_rate_cents"] or 0),
                "skills": list(row["skills"] or []),
                "is_verified": bool(row["is_active"]),
                "is_online": is_online,
                "is_presential": is_presential,
                "next_availability": next_availability,
                "experience_label": _build_experience_label(int(row["experience_count"]), bool(row["hide_experience"])),
                "bio_snippet": row["biography"],
            }
        )

    return {"teachers": teachers}


def get_marketplace_teacher_detail(db: Session, teacher_id: UUID) -> dict:
    settings = get_settings()
    row = (
        db.execute(
            text(
                """
                select
                  t.id,
                  t.user_id,
                  coalesce(nullif(trim(concat_ws(' ', u.first_name, u.last_name)), ''), 'Professora Kidario') as name,
                  t.profile_photo_file_name as avatar_url,
                  t.hourly_rate_cents,
                  t.modality,
                  a.city,
                  a.state,
                  t.biography,
                  t.lesson_duration_minutes,
                  t.hide_experience,
                  coalesce(skills.skills, '{}'::text[]) as skills,
                  coalesce(exp.experience_count, 0) as experience_count,
                  coalesce(reviews.rating, 0) as rating,
                  coalesce(reviews.review_count, 0) as review_count
                from teachers t
                join users u on u.id = t.user_id
                join addresses a on a.id = t.address_id
                left join lateral (
                  select array_agg(s.skill order by s.skill) as skills
                  from teacher_skills s
                  where s.teacher_id = t.id
                ) skills on true
                left join lateral (
                  select count(*)::int as experience_count
                  from teacher_experiences ex
                  where ex.teacher_id = t.id
                ) exp on true
                left join lateral (
                  select round(avg(br.rating)::numeric, 1) as rating, count(*)::int as review_count
                  from booking_reviews br
                  join bookings b on b.id = br.booking_id
                  where b.teacher_id = t.id
                    and br.is_public = true
                    and br.status = 'published'
                ) reviews on true
                where t.id = :teacher_id
                  and t.is_active = true
                """
            ),
            {"teacher_id": str(teacher_id)},
        )
        .mappings()
        .first()
    )
    if not row:
        raise MarketplaceNotFoundError("Teacher not found in marketplace.")

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

    experiences_rows = (
        db.execute(
            text(
                """
                select id, teacher_id, institution, role, coalesce(description, responsibilities) as description,
                       period_from, period_to, current_position
                from teacher_experiences
                where teacher_id = :teacher_id
                order by created_at desc
                """
            ),
            {"teacher_id": str(teacher_id)},
        )
        .mappings()
        .all()
    )

    academic_rows = (
        db.execute(
            text(
                """
                select id, teacher_id, degree_type, course_name, institution, completion_year
                from teacher_academic_records
                where teacher_id = :teacher_id
                order by created_at asc
                """
            ),
            {"teacher_id": str(teacher_id)},
        )
        .mappings()
        .all()
    )

    lesson_duration = int(row["lesson_duration_minutes"] or 60)
    today = datetime.now(LOCAL_TZ).date()
    booked_slots = _load_booked_slots(db, teacher_id, today, today + timedelta(days=21))
    preview_slots = _build_preview_slots(
        [dict(item) for item in schedule_rows],
        duration_minutes=lesson_duration,
        booked_slots_by_date=booked_slots,
    )
    is_online, is_presential = _modality_flags(row["modality"])

    return {
        "id": teacher_id,
        "user_id": row["user_id"],
        "name": row["name"],
        "avatar_url": resolve_teacher_profile_photo_url(settings, row["avatar_url"]),
        "rating": _to_float(row["rating"]),
        "review_count": int(row["review_count"] or 0),
        "price_per_class_cents": int(row["hourly_rate_cents"] or 0),
        "skills": list(row["skills"] or []),
        "is_verified": True,
        "is_online": is_online,
        "is_presential": is_presential,
        "experience_label": _build_experience_label(int(row["experience_count"]), bool(row["hide_experience"])),
        "hide_experience": bool(row["hide_experience"]),
        "bio": row["biography"],
        "city": row["city"],
        "state": row["state"],
        "academic_records": [dict(item) for item in academic_rows],
        "experiences": [] if bool(row["hide_experience"]) else [dict(item) for item in experiences_rows],
        "lesson_duration_minutes": lesson_duration,
        "next_slots": preview_slots,
    }
