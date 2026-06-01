from datetime import date, datetime, time, timedelta
from math import asin, cos, radians, sin, sqrt
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy import bindparam, text
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.schemas.v2_explore import ExploreModalityFilter, ExploreSort
from app.services.storage_url_service import resolve_teacher_profile_photo_url


class ExploreNotFoundError(Exception):
    pass


MIN_BOOKING_LEAD_MINUTES = 60
LOCAL_TZ = ZoneInfo("America/Sao_Paulo")


def _time_parts(value: object) -> tuple[int, int]:
    if isinstance(value, time):
        return value.hour, value.minute

    parts = str(value).strip().split(":")
    if len(parts) < 2:
        raise ValueError(f"Invalid time value: {value!r}")
    return int(parts[0]), int(parts[1])


def _time_to_minutes(value: object) -> int:
    hours, minutes = _time_parts(value)
    return hours * 60 + minutes


def _minutes_to_time(total_minutes: int) -> str:
    hours = total_minutes // 60
    minutes = total_minutes % 60
    return f"{hours:02d}:{minutes:02d}"


def _modality_flags(modality: str | None) -> tuple[bool, bool]:
    normalized = (modality or "online").lower().strip()
    if normalized in ("ambos", "hibrido"):
        return True, True
    if normalized == "presencial":
        return False, True
    return True, False


def _to_float(value) -> float | None:
    if value is None:
        return None
    return float(value)


def _haversine_km(lat_a: float, lng_a: float, lat_b: float, lng_b: float) -> float:
    radius_km = 6371.0
    dlat = radians(lat_b - lat_a)
    dlng = radians(lng_b - lng_a)
    a = sin(dlat / 2) ** 2 + cos(radians(lat_a)) * cos(radians(lat_b)) * sin(dlng / 2) ** 2
    return 2 * radius_km * asin(sqrt(a))


def _normalize_modality_for_slot(teacher_modality: str | None, requested: ExploreModalityFilter | None) -> ExploreModalityFilter:
    if requested:
        return requested
    is_online, _ = _modality_flags(teacher_modality)
    return "online" if is_online else "presencial"


def _build_slot_datetime(date_value: date, time_value: object) -> datetime:
    hours, minutes = _time_parts(time_value)
    return datetime(
        date_value.year,
        date_value.month,
        date_value.day,
        hours,
        minutes,
        tzinfo=LOCAL_TZ,
    )


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
            {"teacher_id": str(teacher_id), "start_bound": start_bound, "end_bound": end_bound},
        )
        .mappings()
        .all()
    )
    booked: dict[date, set[str]] = {}
    for row in rows:
        starts_at = row["starts_at"]
        local_starts_at = starts_at.astimezone(LOCAL_TZ) if starts_at.tzinfo else starts_at.replace(tzinfo=LOCAL_TZ)
        booked.setdefault(local_starts_at.date(), set()).add(local_starts_at.strftime("%H:%M"))
    return booked


def _build_availability_slots(
    *,
    schedule_rows: list[dict],
    teacher_id: UUID,
    db: Session,
    teacher_modality: str | None,
    requested_modality: ExploreModalityFilter | None,
    duration_minutes: int,
    available_from: datetime | None,
    available_to: datetime | None,
    max_slots: int,
) -> list[dict]:
    now = datetime.now(LOCAL_TZ)
    minimum_start = now + timedelta(minutes=MIN_BOOKING_LEAD_MINUTES)
    start_dt = available_from.astimezone(LOCAL_TZ) if available_from and available_from.tzinfo else available_from
    end_dt = available_to.astimezone(LOCAL_TZ) if available_to and available_to.tzinfo else available_to
    if start_dt is None:
        start_dt = minimum_start
    elif start_dt.tzinfo is None:
        start_dt = start_dt.replace(tzinfo=LOCAL_TZ)
    if end_dt is None:
        end_dt = start_dt + timedelta(days=21)
    elif end_dt.tzinfo is None:
        end_dt = end_dt.replace(tzinfo=LOCAL_TZ)

    date_from = max(start_dt.date(), minimum_start.date())
    date_to = end_dt.date()
    if date_to < date_from:
        return []

    booked = _load_booked_slots(db, teacher_id, date_from, date_to)
    rows_by_day: dict[int, list[dict]] = {}
    for row in schedule_rows:
        rows_by_day.setdefault(int(row["day_of_week"]), []).append(dict(row))

    slots: list[dict] = []
    current_date = date_from
    while current_date <= date_to and len(slots) < max_slots:
        blocked_times = booked.get(current_date, set())
        for schedule in rows_by_day.get(current_date.weekday(), []):
            start_minutes = _time_to_minutes(schedule["start_time"])
            end_minutes = _time_to_minutes(schedule["end_time"])
            minute = start_minutes
            while minute + duration_minutes <= end_minutes and len(slots) < max_slots:
                time_value = _minutes_to_time(minute)
                starts_at = _build_slot_datetime(current_date, time_value)
                if starts_at >= minimum_start and starts_at >= start_dt and starts_at <= end_dt and time_value not in blocked_times:
                    slots.append(
                        {
                            "starts_at": starts_at,
                            "duration_minutes": duration_minutes,
                            "modality": _normalize_modality_for_slot(teacher_modality, requested_modality),
                        }
                    )
                minute += duration_minutes
        current_date += timedelta(days=1)
    return slots


def _estimate_package_amounts(row: dict, hourly_rate_cents: int | None, lesson_duration_minutes: int | None) -> dict:
    if hourly_rate_cents is None or lesson_duration_minutes is None:
        return {"estimated_original_amount_cents": None, "estimated_final_amount_cents": None}
    unit_amount = round(int(hourly_rate_cents) * (int(lesson_duration_minutes) / 60))
    original = unit_amount * int(row["sessions_count"])
    discount_percent = float(row["discount_percent"] or 0)
    final = round(original * (1 - discount_percent / 100))
    return {"estimated_original_amount_cents": original, "estimated_final_amount_cents": final}


def _package_summary(package_rows: list[dict], hourly_rate_cents: int | None, lesson_duration_minutes: int | None) -> dict:
    active_rows = [row for row in package_rows if row.get("is_active")]
    if not active_rows:
        return {"has_packages": False, "starting_estimated_amount_cents": None, "max_discount_percent": None}
    estimated = [
        _estimate_package_amounts(row, hourly_rate_cents, lesson_duration_minutes)["estimated_final_amount_cents"]
        for row in active_rows
    ]
    estimated = [value for value in estimated if value is not None]
    return {
        "has_packages": True,
        "starting_estimated_amount_cents": min(estimated) if estimated else None,
        "max_discount_percent": max(float(row["discount_percent"] or 0) for row in active_rows),
    }


def _public_package_plan(row: dict, hourly_rate_cents: int | None, lesson_duration_minutes: int | None) -> dict:
    estimates = _estimate_package_amounts(row, hourly_rate_cents, lesson_duration_minutes)
    return {
        "id": row["id"],
        "code": row["code"],
        "name": row["name"],
        "description": row["description"],
        "sessions_count": row["sessions_count"],
        "discount_percent": float(row["discount_percent"] or 0),
        "estimated_original_amount_cents": estimates["estimated_original_amount_cents"],
        "estimated_final_amount_cents": estimates["estimated_final_amount_cents"],
        "currency": "BRL",
        "is_active": row["is_active"],
    }


def _load_teacher_packages(db: Session, teacher_id: UUID) -> list[dict]:
    rows = (
        db.execute(
            text(
                """
                select id, code, name, description, sessions_count, discount_percent, is_active
                from package_plans
                where teacher_id = :teacher_id
                  and is_active = true
                order by sessions_count asc, discount_percent desc, name asc
                """
            ),
            {"teacher_id": str(teacher_id)},
        )
        .mappings()
        .all()
    )
    return [dict(row) for row in rows]


def _load_teacher_latest_reviews(db: Session, teacher_id: UUID, limit: int) -> list[dict]:
    rows = (
        db.execute(
            text(
                """
                select br.id, br.rating, br.comment, br.submitted_at
                from booking_reviews br
                join bookings b on b.id = br.booking_id
                where b.teacher_id = :teacher_id
                  and br.is_public = true
                  and br.status = 'published'
                order by br.submitted_at desc
                limit :limit
                """
            ),
            {"teacher_id": str(teacher_id), "limit": limit},
        )
        .mappings()
        .all()
    )
    return [dict(row) for row in rows]


def list_explore_teachers(
    db: Session,
    *,
    query: str | None = None,
    skill: str | None = None,
    city: str | None = None,
    state: str | None = None,
    modality: ExploreModalityFilter | None = None,
    available_from: datetime | None = None,
    available_to: datetime | None = None,
    duration_minutes: int | None = None,
    min_rating: float | None = None,
    has_reviews: bool | None = None,
    max_hourly_rate_cents: int | None = None,
    sort: ExploreSort = "relevance",
    near_lat: float | None = None,
    near_lng: float | None = None,
    radius_km: float | None = None,
    limit: int = 50,
    offset: int = 0,
) -> dict:
    settings = get_settings()
    where = ["t.is_active = true"]
    params: dict[str, object] = {"limit": limit, "offset": offset}
    if settings.pagarme_enabled:
        where.append(
            """
            exists (
              select 1
              from payment_provider_recipients ppr
              where ppr.teacher_id = t.id
                and ppr.provider = 'pagarme'
                and ppr.status = 'active'
            )
            """
        )

    if query:
        where.append(
            """
            (
              coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, '') ilike :query
              or coalesce(t.biography, '') ilike :query
              or exists (
                select 1 from teacher_skills sq
                where sq.teacher_id = t.id and sq.skill ilike :query
              )
            )
            """
        )
        params["query"] = f"%{query.strip()}%"
    if skill:
        where.append(
            """
            exists (
              select 1 from teacher_skills sf
              where sf.teacher_id = t.id and sf.skill ilike :skill
            )
            """
        )
        params["skill"] = f"%{skill.strip()}%"
    if city:
        where.append("a.city ilike :city")
        params["city"] = f"%{city.strip()}%"
    if state:
        where.append("upper(a.state) = upper(:state)")
        params["state"] = state.strip()
    if modality == "online":
        where.append("(t.modality in ('online', 'ambos') or t.modality is null)")
    elif modality == "presencial":
        where.append("t.modality in ('presencial', 'ambos')")
    if max_hourly_rate_cents is not None:
        where.append("t.hourly_rate_cents <= :max_hourly_rate_cents")
        params["max_hourly_rate_cents"] = max_hourly_rate_cents

    rows = (
        db.execute(
            text(
                f"""
                select
                  t.id as teacher_id,
                  coalesce(nullif(trim(concat_ws(' ', u.first_name, u.last_name)), ''), 'Professora Kidario') as display_name,
                  t.profile_photo_file_name,
                  t.biography,
                  t.modality,
                  t.hourly_rate_cents,
                  coalesce(t.lesson_duration_minutes, 60) as lesson_duration_minutes,
                  a.city,
                  a.state,
                  a.country,
                  a.latitude,
                  a.longitude,
                  coalesce(skills.skills, '{{}}'::text[]) as skills,
                  reviews.rating_average,
                  coalesce(reviews.review_count, 0) as review_count,
                  latest_review.id as latest_review_id,
                  latest_review.rating as latest_review_rating,
                  latest_review.comment as latest_review_comment,
                  latest_review.submitted_at as latest_review_submitted_at
                from teachers t
                join users u on u.id = t.user_id
                join addresses a on a.id = t.address_id
                left join lateral (
                  select array_agg(s.skill order by s.skill) as skills
                  from teacher_skills s
                  where s.teacher_id = t.id
                ) skills on true
                left join lateral (
                  select round(avg(br.rating)::numeric, 1) as rating_average, count(*)::int as review_count
                  from booking_reviews br
                  join bookings b on b.id = br.booking_id
                  where b.teacher_id = t.id
                    and br.is_public = true
                    and br.status = 'published'
                ) reviews on true
                left join lateral (
                  select br.id, br.rating, br.comment, br.submitted_at
                  from booking_reviews br
                  join bookings b on b.id = br.booking_id
                  where b.teacher_id = t.id
                    and br.is_public = true
                    and br.status = 'published'
                  order by br.submitted_at desc
                  limit 1
                ) latest_review on true
                where {' and '.join(where)}
                order by display_name asc
                limit :limit
                offset :offset
                """
            ),
            params,
        )
        .mappings()
        .all()
    )

    teacher_ids = [str(row["teacher_id"]) for row in rows]
    schedule_rows = []
    if teacher_ids:
        stmt = text(
            """
            select teacher_id, day_of_week, start_time, end_time
            from teacher_availability
            where teacher_id in :teacher_ids
            order by day_of_week asc, start_time asc
            """
        ).bindparams(bindparam("teacher_ids", expanding=True))
        schedule_rows = db.execute(stmt, {"teacher_ids": teacher_ids}).mappings().all()

    schedules_by_teacher: dict[str, list[dict]] = {}
    for row in schedule_rows:
        schedules_by_teacher.setdefault(str(row["teacher_id"]), []).append(dict(row))

    teachers = []
    for row in rows:
        row_dict = dict(row)
        teacher_id = UUID(str(row_dict["teacher_id"]))
        lesson_duration = int(duration_minutes or row_dict["lesson_duration_minutes"] or 60)
        slots = _build_availability_slots(
            schedule_rows=schedules_by_teacher.get(str(teacher_id), []),
            teacher_id=teacher_id,
            db=db,
            teacher_modality=row_dict["modality"],
            requested_modality=modality,
            duration_minutes=lesson_duration,
            available_from=available_from,
            available_to=available_to,
            max_slots=3,
        )
        if (available_from or available_to) and not slots:
            continue

        rating_average = _to_float(row_dict["rating_average"])
        review_count = int(row_dict["review_count"] or 0)
        if min_rating is not None and (rating_average is None or rating_average < min_rating):
            continue
        if has_reviews is True and review_count == 0:
            continue
        if has_reviews is False and review_count > 0:
            continue

        distance_km = None
        if near_lat is not None and near_lng is not None and row_dict["latitude"] is not None and row_dict["longitude"] is not None:
            distance_km = round(_haversine_km(near_lat, near_lng, float(row_dict["latitude"]), float(row_dict["longitude"])), 1)
            if radius_km is not None and distance_km > radius_km:
                continue

        packages = _load_teacher_packages(db, teacher_id)
        teachers.append(
            {
                "teacher_id": teacher_id,
                "display_name": row_dict["display_name"],
                "biography_preview": row_dict["biography"],
                "profile_photo_url": resolve_teacher_profile_photo_url(settings, row_dict["profile_photo_file_name"]),
                "location": {
                    "city": row_dict["city"],
                    "state": row_dict["state"],
                    "country": row_dict["country"] or "BR",
                    "distance_km": distance_km,
                },
                "modality": row_dict["modality"],
                "hourly_rate_cents": row_dict["hourly_rate_cents"],
                "lesson_duration_minutes": row_dict["lesson_duration_minutes"],
                "skills": list(row_dict["skills"] or []),
                "rating_summary": {"average": rating_average, "count": review_count},
                "availability_summary": {
                    "next_available_at": slots[0]["starts_at"] if slots else None,
                    "preview_slots": slots,
                    "range_days": None,
                },
                "package_summary": _package_summary(
                    packages,
                    row_dict["hourly_rate_cents"],
                    row_dict["lesson_duration_minutes"],
                ),
                "latest_review": {
                    "id": row_dict["latest_review_id"],
                    "rating": row_dict["latest_review_rating"],
                    "comment": row_dict["latest_review_comment"],
                    "submitted_at": row_dict["latest_review_submitted_at"],
                }
                if row_dict.get("latest_review_id")
                else None,
            }
        )

    if sort == "soonest_available":
        teachers.sort(key=lambda item: item["availability_summary"]["next_available_at"] or datetime.max.replace(tzinfo=LOCAL_TZ))
    elif sort == "rating":
        teachers.sort(key=lambda item: (item["rating_summary"]["average"] or 0, item["rating_summary"]["count"]), reverse=True)
    elif sort == "price_low":
        teachers.sort(key=lambda item: item["hourly_rate_cents"] if item["hourly_rate_cents"] is not None else 10**12)
    elif sort == "price_high":
        teachers.sort(key=lambda item: item["hourly_rate_cents"] or 0, reverse=True)
    elif sort == "nearby":
        teachers.sort(key=lambda item: item["location"]["distance_km"] if item["location"]["distance_km"] is not None else 10**12)

    return {"teachers": teachers}


def get_explore_teacher_detail(
    db: Session,
    teacher_id: UUID,
    *,
    available_from: datetime | None = None,
    available_to: datetime | None = None,
    duration_minutes: int | None = None,
    modality: ExploreModalityFilter | None = None,
) -> dict:
    settings = get_settings()
    row = (
        db.execute(
            text(
                """
                select
                  t.id as teacher_id,
                  coalesce(nullif(trim(concat_ws(' ', u.first_name, u.last_name)), ''), 'Professora Kidario') as display_name,
                  t.profile_photo_file_name,
                  t.biography,
                  t.modality,
                  t.hourly_rate_cents,
                  coalesce(t.lesson_duration_minutes, 60) as lesson_duration_minutes,
                  t.hide_experience,
                  a.city,
                  a.state,
                  a.country,
                  coalesce(skills.skills, '{}'::text[]) as skills,
                  reviews.rating_average,
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
                  select round(avg(br.rating)::numeric, 1) as rating_average, count(*)::int as review_count
                  from booking_reviews br
                  join bookings b on b.id = br.booking_id
                  where b.teacher_id = t.id
                    and br.is_public = true
                    and br.status = 'published'
                ) reviews on true
                where t.id = :teacher_id
                  and t.is_active = true
                  and (
                    :pagarme_enabled = false
                    or exists (
                      select 1
                      from payment_provider_recipients ppr
                      where ppr.teacher_id = t.id
                        and ppr.provider = 'pagarme'
                        and ppr.status = 'active'
                    )
                  )
                """
            ),
            {"teacher_id": str(teacher_id), "pagarme_enabled": settings.pagarme_enabled},
        )
        .mappings()
        .first()
    )
    if not row:
        raise ExploreNotFoundError("Teacher not found in explore.")

    row_dict = dict(row)
    schedule_rows = (
        db.execute(
            text(
                """
                select teacher_id, day_of_week, start_time, end_time
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
    lesson_duration = int(duration_minutes or row_dict["lesson_duration_minutes"] or 60)
    slots = _build_availability_slots(
        schedule_rows=[dict(item) for item in schedule_rows],
        teacher_id=teacher_id,
        db=db,
        teacher_modality=row_dict["modality"],
        requested_modality=modality,
        duration_minutes=lesson_duration,
        available_from=available_from,
        available_to=available_to,
        max_slots=12,
    )
    date_start = available_from.astimezone(LOCAL_TZ).date() if available_from and available_from.tzinfo else None
    date_end = available_to.astimezone(LOCAL_TZ).date() if available_to and available_to.tzinfo else None
    range_days = (date_end - date_start).days + 1 if date_start and date_end and date_end >= date_start else 14

    package_rows = _load_teacher_packages(db, teacher_id)
    academic_rows = (
        db.execute(
            text(
                """
                select id, degree_type, course_name, institution, completion_year
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
    experience_rows = []
    if not row_dict["hide_experience"]:
        experience_rows = (
            db.execute(
                text(
                    """
                    select
                      id, institution, role, coalesce(description, responsibilities) as description,
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

    latest_reviews = _load_teacher_latest_reviews(db, teacher_id, limit=5)

    return {
        "teacher_id": teacher_id,
        "display_name": row_dict["display_name"],
        "biography": row_dict["biography"],
        "profile_photo_url": resolve_teacher_profile_photo_url(settings, row_dict["profile_photo_file_name"]),
        "location": {"city": row_dict["city"], "state": row_dict["state"], "country": row_dict["country"] or "BR"},
        "modality": row_dict["modality"],
        "hourly_rate_cents": row_dict["hourly_rate_cents"],
        "lesson_duration_minutes": row_dict["lesson_duration_minutes"],
        "skills": list(row_dict["skills"] or []),
        "academic_records": [dict(row) for row in academic_rows],
        "experiences": [dict(row) for row in experience_rows],
        "rating_summary": {
            "average": _to_float(row_dict["rating_average"]),
            "count": int(row_dict["review_count"] or 0),
        },
        "availability_summary": {
            "next_available_at": slots[0]["starts_at"] if slots else None,
            "preview_slots": slots,
            "range_days": range_days,
        },
        "package_summary": _package_summary(
            package_rows,
            row_dict["hourly_rate_cents"],
            row_dict["lesson_duration_minutes"],
        ),
        "package_plans": [
            _public_package_plan(row, row_dict["hourly_rate_cents"], row_dict["lesson_duration_minutes"])
            for row in package_rows
        ],
        "latest_reviews": latest_reviews,
    }
