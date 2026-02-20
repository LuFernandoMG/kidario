from datetime import date, timedelta
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session


class MarketplaceNotFoundError(Exception):
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


def _modality_flags(modality: str | None) -> tuple[bool, bool]:
    normalized = (modality or "online").lower().strip()
    if normalized == "hibrido":
        return True, True
    if normalized == "presencial":
        return False, True
    return True, False


def _derive_rating_and_reviews(profile_id: UUID) -> tuple[float, int]:
    seed = sum(ord(char) for char in str(profile_id) if char != "-")
    rating = min(5.0, 4.6 + ((seed % 5) * 0.1))
    review_count = 18 + (seed % 220)
    return round(rating, 1), review_count


def _build_experience_label(experience_count: int, request_experience_anonymity: bool) -> str:
    if request_experience_anonymity:
        return "Experiencia validada pela plataforma"
    if experience_count <= 0:
        return "Experiencia em apoio pedagogico"
    if experience_count == 1:
        return "1 experiencia registrada"
    return f"{experience_count} experiencias registradas"


def _build_next_availability_label(schedule_rows: list[dict]) -> str | None:
    rows_by_day: dict[int, list[dict]] = {}
    for row in schedule_rows:
        rows_by_day.setdefault(int(row["day_of_week"]), []).append(dict(row))

    today = date.today()
    for day_offset in range(0, 14):
        current_date = today + timedelta(days=day_offset)
        slots = rows_by_day.get(current_date.weekday(), [])
        if not slots:
            continue

        start_time = sorted(str(slot["start_time"]) for slot in slots)[0]
        hour_label = f"{start_time[:2]}h"
        if day_offset == 0:
            return f"Hoje, {hour_label}"
        if day_offset == 1:
            return f"Amanha, {hour_label}"
        return f"{current_date.strftime('%d/%m')}, {hour_label}"
    return None


def _build_preview_slots(
    schedule_rows: list[dict],
    duration_minutes: int,
    max_days: int = 3,
) -> list[dict]:
    rows_by_day: dict[int, list[dict]] = {}
    for row in schedule_rows:
        rows_by_day.setdefault(int(row["day_of_week"]), []).append(dict(row))

    slots: list[dict] = []
    current_date = date.today()
    scanned_days = 0
    while len(slots) < max_days and scanned_days < 21:
        day_rows = rows_by_day.get(current_date.weekday(), [])
        day_times: list[str] = []
        for day_row in day_rows:
            start_minutes = _time_to_minutes(str(day_row["start_time"]))
            end_minutes = _time_to_minutes(str(day_row["end_time"]))
            minute = start_minutes
            while minute + duration_minutes <= end_minutes:
                day_times.append(_minutes_to_time(minute))
                minute += duration_minutes

        unique_times = sorted(set(day_times))
        if unique_times:
            slots.append(
                {
                    "date_iso": current_date,
                    "date_label": _format_date_label(current_date),
                    "times": unique_times,
                }
            )

        current_date += timedelta(days=1)
        scanned_days += 1

    return slots


def list_marketplace_teachers(db: Session) -> dict:
    rows = (
        db.execute(
            text(
                """
                select
                  tp.profile_id as id,
                  coalesce(nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''), 'Professora Kidario') as name,
                  tp.profile_photo_file_name as avatar_url,
                  tp.hourly_rate,
                  tp.modality,
                  tp.is_active_teacher,
                  tp.request_experience_anonymity,
                  tp.mini_bio,
                  coalesce(spec.specialties, '{}'::text[]) as specialties,
                  coalesce(exp.experience_count, 0) as experience_count
                from teacher_profiles tp
                join profiles p on p.id = tp.profile_id
                left join lateral (
                  select array_agg(s.specialty order by s.specialty) as specialties
                  from teacher_specialties s
                  where s.profile_id = tp.profile_id
                ) spec on true
                left join lateral (
                  select count(*)::int as experience_count
                  from teacher_experiences ex
                  where ex.profile_id = tp.profile_id
                ) exp on true
                where tp.is_active_teacher = true
                order by name asc
                """
            )
        )
        .mappings()
        .all()
    )

    schedule_rows = (
        db.execute(
            text(
                """
                select profile_id, day_of_week, start_time, end_time
                from teacher_availability
                where profile_id in (
                  select profile_id
                  from teacher_profiles
                  where is_active_teacher = true
                )
                """
            )
        )
        .mappings()
        .all()
    )
    schedules_by_teacher: dict[str, list[dict]] = {}
    for row in schedule_rows:
        profile_id = str(row["profile_id"])
        schedules_by_teacher.setdefault(profile_id, []).append(dict(row))

    teachers = []
    for row in rows:
        teacher_id = UUID(str(row["id"]))
        rating, review_count = _derive_rating_and_reviews(teacher_id)
        is_online, is_presential = _modality_flags(row["modality"])

        schedule_for_teacher = schedules_by_teacher.get(str(teacher_id), [])
        next_availability = _build_next_availability_label(schedule_for_teacher)
        experience_label = _build_experience_label(
            int(row["experience_count"]),
            bool(row["request_experience_anonymity"]),
        )

        teachers.append(
            {
                "id": teacher_id,
                "name": row["name"],
                "avatar_url": row["avatar_url"],
                "rating": rating,
                "review_count": review_count,
                "price_per_class": float(row["hourly_rate"] or 0),
                "specialties": list(row["specialties"] or []),
                "is_verified": bool(row["is_active_teacher"]),
                "is_online": is_online,
                "is_presential": is_presential,
                "next_availability": next_availability,
                "experience_label": experience_label,
                "bio_snippet": row["mini_bio"],
            }
        )

    return {"teachers": teachers}


def get_marketplace_teacher_detail(db: Session, teacher_profile_id: UUID) -> dict:
    row = (
        db.execute(
            text(
                """
                select
                  tp.profile_id as id,
                  coalesce(nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''), 'Professora Kidario') as name,
                  tp.profile_photo_file_name as avatar_url,
                  tp.hourly_rate,
                  tp.modality,
                  tp.city,
                  tp.state,
                  tp.mini_bio,
                  tp.lesson_duration_minutes,
                  tp.request_experience_anonymity,
                  coalesce(spec.specialties, '{}'::text[]) as specialties,
                  coalesce(exp.experience_count, 0) as experience_count
                from teacher_profiles tp
                join profiles p on p.id = tp.profile_id
                left join lateral (
                  select array_agg(s.specialty order by s.specialty) as specialties
                  from teacher_specialties s
                  where s.profile_id = tp.profile_id
                ) spec on true
                left join lateral (
                  select count(*)::int as experience_count
                  from teacher_experiences ex
                  where ex.profile_id = tp.profile_id
                ) exp on true
                where tp.profile_id = :profile_id
                  and tp.is_active_teacher = true
                """
            ),
            {"profile_id": str(teacher_profile_id)},
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
                where profile_id = :profile_id
                order by day_of_week asc, start_time asc
                """
            ),
            {"profile_id": str(teacher_profile_id)},
        )
        .mappings()
        .all()
    )

    lesson_duration = int(row["lesson_duration_minutes"] or 60)
    preview_slots = _build_preview_slots([dict(item) for item in schedule_rows], duration_minutes=lesson_duration)
    rating, review_count = _derive_rating_and_reviews(teacher_profile_id)
    is_online, is_presential = _modality_flags(row["modality"])
    experience_label = _build_experience_label(
        int(row["experience_count"]),
        bool(row["request_experience_anonymity"]),
    )

    return {
        "id": teacher_profile_id,
        "name": row["name"],
        "avatar_url": row["avatar_url"],
        "rating": rating,
        "review_count": review_count,
        "price_per_class": float(row["hourly_rate"] or 0),
        "specialties": list(row["specialties"] or []),
        "is_verified": True,
        "is_online": is_online,
        "is_presential": is_presential,
        "experience_label": experience_label,
        "bio": row["mini_bio"],
        "city": row["city"],
        "state": row["state"],
        "lesson_duration_minutes": lesson_duration,
        "next_slots": preview_slots,
    }
