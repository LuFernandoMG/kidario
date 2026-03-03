from collections import defaultdict
from decimal import Decimal

from sqlalchemy import text
from sqlalchemy.orm import Session


def _build_full_name(first_name: str | None, last_name: str | None, email: str | None) -> str:
    full_name = " ".join(part for part in [first_name, last_name] if part and part.strip()).strip()
    if full_name:
        return full_name
    if email and email.strip():
        return email.strip()
    return "Sem nome"


def _to_float(value: Decimal | float | int | None) -> float | None:
    if value is None:
        return None
    return float(value)


def _format_formation(row: dict) -> str:
    base = " - ".join(
        part
        for part in [
            f"{row.get('degree_type')}: {row.get('course_name')}" if row.get("degree_type") and row.get("course_name")
            else row.get("course_name"),
            row.get("institution"),
        ]
        if part
    ).strip()
    completion_year = str(row.get("completion_year") or "").strip()
    if completion_year:
        return f"{base} ({completion_year})" if base else completion_year
    return base or "Formação não informada"


def _format_experience(row: dict) -> str:
    role = str(row.get("role") or "").strip()
    institution = str(row.get("institution") or "").strip()
    period_from = str(row.get("period_from") or "").strip()
    period_to = str(row.get("period_to") or "").strip()
    period_end_label = "Atual" if row.get("current_position") else (period_to or "N/D")

    main = " - ".join(part for part in [role, institution] if part).strip()
    if period_from or period_end_label:
        return f"{main} ({period_from or 'N/D'} a {period_end_label})".strip()
    return main or "Experiência não informada"


def get_admin_dashboard(db: Session) -> dict:
    teacher_rows = (
        db.execute(
            text(
                """
                select
                  tp.profile_id,
                  p.first_name,
                  p.last_name,
                  p.email,
                  tp.phone,
                  tp.city,
                  tp.state,
                  tp.modality,
                  tp.hourly_rate,
                  tp.is_active_teacher,
                  tp.created_at
                from teacher_profiles tp
                join profiles p on p.id = tp.profile_id
                order by tp.created_at desc
                """
            )
        )
        .mappings()
        .all()
    )

    formation_rows = (
        db.execute(
            text(
                """
                select
                  profile_id,
                  degree_type,
                  course_name,
                  institution,
                  completion_year
                from teacher_formations
                order by created_at desc
                """
            )
        )
        .mappings()
        .all()
    )

    experience_rows = (
        db.execute(
            text(
                """
                select
                  profile_id,
                  institution,
                  role,
                  period_from,
                  period_to,
                  current_position
                from teacher_experiences
                order by created_at desc
                """
            )
        )
        .mappings()
        .all()
    )

    parent_rows = (
        db.execute(
            text(
                """
                select
                  pp.profile_id,
                  p.first_name,
                  p.last_name,
                  p.email,
                  pp.phone,
                  pp.address,
                  pp.bio,
                  pp.created_at,
                  coalesce(children.children_count, 0) as children_count
                from parent_profiles pp
                join profiles p on p.id = pp.profile_id
                left join (
                  select profile_id, count(*) as children_count
                  from parent_children
                  group by profile_id
                ) as children on children.profile_id = pp.profile_id
                order by pp.created_at desc
                """
            )
        )
        .mappings()
        .all()
    )

    booking_rows = (
        db.execute(
            text(
                """
                select
                  b.id as booking_id,
                  b.parent_profile_id,
                  b.teacher_profile_id,
                  b.child_id,
                  pp_parent.first_name as parent_first_name,
                  pp_parent.last_name as parent_last_name,
                  pp_parent.email as parent_email,
                  pp_teacher.first_name as teacher_first_name,
                  pp_teacher.last_name as teacher_last_name,
                  pp_teacher.email as teacher_email,
                  pc.name as child_name,
                  b.date_iso,
                  b.time,
                  b.duration_minutes,
                  b.modality,
                  b.status as booking_status,
                  b.payment_method,
                  b.payment_status,
                  b.price_total,
                  b.currency,
                  b.created_at
                from bookings b
                join profiles pp_parent on pp_parent.id = b.parent_profile_id
                join profiles pp_teacher on pp_teacher.id = b.teacher_profile_id
                join parent_children pc on pc.id = b.child_id
                order by b.date_iso desc, b.time desc, b.created_at desc
                """
            )
        )
        .mappings()
        .all()
    )

    payment_rows = (
        db.execute(
            text(
                """
                select
                  b.id as booking_id,
                  b.parent_profile_id,
                  b.teacher_profile_id,
                  pp_parent.first_name as parent_first_name,
                  pp_parent.last_name as parent_last_name,
                  pp_parent.email as parent_email,
                  pp_teacher.first_name as teacher_first_name,
                  pp_teacher.last_name as teacher_last_name,
                  pp_teacher.email as teacher_email,
                  b.payment_method,
                  b.payment_status,
                  b.status as booking_status,
                  b.price_total,
                  b.currency,
                  b.created_at,
                  b.updated_at
                from bookings b
                join profiles pp_parent on pp_parent.id = b.parent_profile_id
                join profiles pp_teacher on pp_teacher.id = b.teacher_profile_id
                order by b.created_at desc
                """
            )
        )
        .mappings()
        .all()
    )

    formations_by_profile_id: dict[str, list[str]] = defaultdict(list)
    for row in formation_rows:
        profile_id = str(row["profile_id"])
        formations_by_profile_id[profile_id].append(_format_formation(dict(row)))

    experiences_by_profile_id: dict[str, list[str]] = defaultdict(list)
    for row in experience_rows:
        profile_id = str(row["profile_id"])
        experiences_by_profile_id[profile_id].append(_format_experience(dict(row)))

    return {
        "teachers": [
            {
                "profile_id": row["profile_id"],
                "full_name": _build_full_name(row["first_name"], row["last_name"], row["email"]),
                "email": row["email"],
                "phone": row["phone"],
                "city": row["city"],
                "state": row["state"],
                "modality": row["modality"],
                "hourly_rate": _to_float(row["hourly_rate"]),
                "formations": formations_by_profile_id.get(str(row["profile_id"]), []),
                "experiences": experiences_by_profile_id.get(str(row["profile_id"]), []),
                "is_active_teacher": bool(row["is_active_teacher"]),
                "created_at": row["created_at"],
            }
            for row in teacher_rows
        ],
        "parents": [
            {
                "profile_id": row["profile_id"],
                "full_name": _build_full_name(row["first_name"], row["last_name"], row["email"]),
                "email": row["email"],
                "phone": row["phone"],
                "address": row["address"],
                "bio": row["bio"],
                "children_count": int(row["children_count"]),
                "created_at": row["created_at"],
            }
            for row in parent_rows
        ],
        "bookings": [
            {
                "booking_id": row["booking_id"],
                "parent_profile_id": row["parent_profile_id"],
                "parent_name": _build_full_name(
                    row["parent_first_name"],
                    row["parent_last_name"],
                    row["parent_email"],
                ),
                "teacher_profile_id": row["teacher_profile_id"],
                "teacher_name": _build_full_name(
                    row["teacher_first_name"],
                    row["teacher_last_name"],
                    row["teacher_email"],
                ),
                "child_id": row["child_id"],
                "child_name": row["child_name"],
                "date_iso": row["date_iso"],
                "time": row["time"],
                "duration_minutes": int(row["duration_minutes"]),
                "modality": row["modality"],
                "booking_status": row["booking_status"],
                "payment_method": row["payment_method"],
                "payment_status": row["payment_status"],
                "price_total": _to_float(row["price_total"]) or 0.0,
                "currency": row["currency"],
                "created_at": row["created_at"],
            }
            for row in booking_rows
        ],
        "payments": [
            {
                "booking_id": row["booking_id"],
                "parent_profile_id": row["parent_profile_id"],
                "parent_name": _build_full_name(
                    row["parent_first_name"],
                    row["parent_last_name"],
                    row["parent_email"],
                ),
                "teacher_profile_id": row["teacher_profile_id"],
                "teacher_name": _build_full_name(
                    row["teacher_first_name"],
                    row["teacher_last_name"],
                    row["teacher_email"],
                ),
                "payment_method": row["payment_method"],
                "payment_status": row["payment_status"],
                "booking_status": row["booking_status"],
                "price_total": _to_float(row["price_total"]) or 0.0,
                "currency": row["currency"],
                "created_at": row["created_at"],
                "updated_at": row["updated_at"],
            }
            for row in payment_rows
        ],
    }
