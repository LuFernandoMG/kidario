from collections import defaultdict

from sqlalchemy import text
from sqlalchemy.orm import Session


def _build_full_name(first_name: str | None, last_name: str | None, email: str | None) -> str:
    full_name = " ".join(part for part in [first_name, last_name] if part and part.strip()).strip()
    if full_name:
        return full_name
    if email and email.strip():
        return email.strip()
    return "Sem nome"


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
                  t.id as teacher_id,
                  t.user_id,
                  u.first_name,
                  u.last_name,
                  u.email,
                  t.phone,
                  a.city,
                  a.state,
                  t.modality,
                  t.hourly_rate_cents,
                  t.is_active,
                  t.created_at
                from teachers t
                join users u on u.id = t.user_id
                join addresses a on a.id = t.address_id
                order by t.created_at desc
                """
            )
        )
        .mappings()
        .all()
    )

    academic_rows = (
        db.execute(
            text(
                """
                select teacher_id, degree_type, course_name, institution, completion_year
                from teacher_academic_records
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
                select teacher_id, institution, role, period_from, period_to, current_position
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
                  p.id as parent_id,
                  p.user_id,
                  u.first_name,
                  u.last_name,
                  u.email,
                  p.phone,
                  a.city,
                  a.state,
                  p.bio,
                  p.created_at,
                  coalesce(children.children_count, 0) as children_count
                from parents p
                join users u on u.id = p.user_id
                join addresses a on a.id = p.address_id
                left join (
                  select parent_id, count(*) as children_count
                  from children
                  group by parent_id
                ) as children on children.parent_id = p.id
                order by p.created_at desc
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
                  b.parent_id,
                  b.teacher_id,
                  b.child_id,
                  u_parent.first_name as parent_first_name,
                  u_parent.last_name as parent_last_name,
                  u_parent.email as parent_email,
                  u_teacher.first_name as teacher_first_name,
                  u_teacher.last_name as teacher_last_name,
                  u_teacher.email as teacher_email,
                  c.name as child_name,
                  b.starts_at,
                  b.duration_minutes,
                  b.modality,
                  b.status as booking_status,
                  coalesce(po.amount_cents, 0) as amount_cents,
                  coalesce(po.currency, b.currency, 'BRL') as currency,
                  b.created_at
                from bookings b
                join parents p on p.id = b.parent_id
                join teachers t on t.id = b.teacher_id
                join users u_parent on u_parent.id = p.user_id
                join users u_teacher on u_teacher.id = t.user_id
                join children c on c.id = b.child_id
                left join lateral (
                  select amount_cents, currency
                  from payment_orders
                  where booking_id = b.id
                  order by created_at desc
                  limit 1
                ) po on true
                order by b.starts_at desc, b.created_at desc
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
                  po.id as payment_order_id,
                  po.booking_id,
                  po.package_id,
                  po.parent_id,
                  u_parent.first_name as parent_first_name,
                  u_parent.last_name as parent_last_name,
                  u_parent.email as parent_email,
                  b.teacher_id,
                  u_teacher.first_name as teacher_first_name,
                  u_teacher.last_name as teacher_last_name,
                  u_teacher.email as teacher_email,
                  pc.payment_method,
                  po.status as payment_status,
                  b.status as booking_status,
                  po.amount_cents,
                  po.currency,
                  po.created_at,
                  po.updated_at
                from payment_orders po
                join parents p on p.id = po.parent_id
                join users u_parent on u_parent.id = p.user_id
                left join bookings b on b.id = po.booking_id
                left join teachers t on t.id = b.teacher_id
                left join users u_teacher on u_teacher.id = t.user_id
                left join lateral (
                  select payment_method
                  from payment_charges
                  where payment_order_id = po.id
                  order by created_at desc
                  limit 1
                ) pc on true
                order by po.created_at desc
                """
            )
        )
        .mappings()
        .all()
    )

    review_rows = (
        db.execute(
            text(
                """
                select
                  br.id,
                  br.booking_id,
                  b.parent_id,
                  b.teacher_id,
                  br.rating,
                  br.comment,
                  br.is_public,
                  br.status,
                  br.submitted_at,
                  br.created_at,
                  br.updated_at
                from booking_reviews br
                join bookings b on b.id = br.booking_id
                order by br.submitted_at desc
                limit 100
                """
            )
        )
        .mappings()
        .all()
    )

    academics_by_teacher_id: dict[str, list[str]] = defaultdict(list)
    for row in academic_rows:
        academics_by_teacher_id[str(row["teacher_id"])].append(_format_formation(dict(row)))

    experiences_by_teacher_id: dict[str, list[str]] = defaultdict(list)
    for row in experience_rows:
        experiences_by_teacher_id[str(row["teacher_id"])].append(_format_experience(dict(row)))

    return {
        "teachers": [
            {
                "teacher_id": row["teacher_id"],
                "user_id": row["user_id"],
                "full_name": _build_full_name(row["first_name"], row["last_name"], row["email"]),
                "email": row["email"],
                "phone": row["phone"],
                "city": row["city"],
                "state": row["state"],
                "modality": row["modality"],
                "hourly_rate_cents": row["hourly_rate_cents"],
                "academic_records": academics_by_teacher_id.get(str(row["teacher_id"]), []),
                "experiences": experiences_by_teacher_id.get(str(row["teacher_id"]), []),
                "is_active": bool(row["is_active"]),
                "created_at": row["created_at"],
            }
            for row in teacher_rows
        ],
        "parents": [
            {
                "parent_id": row["parent_id"],
                "user_id": row["user_id"],
                "full_name": _build_full_name(row["first_name"], row["last_name"], row["email"]),
                "email": row["email"],
                "phone": row["phone"],
                "city": row["city"],
                "state": row["state"],
                "bio": row["bio"],
                "children_count": int(row["children_count"]),
                "created_at": row["created_at"],
            }
            for row in parent_rows
        ],
        "bookings": [
            {
                "booking_id": row["booking_id"],
                "parent_id": row["parent_id"],
                "parent_name": _build_full_name(row["parent_first_name"], row["parent_last_name"], row["parent_email"]),
                "teacher_id": row["teacher_id"],
                "teacher_name": _build_full_name(row["teacher_first_name"], row["teacher_last_name"], row["teacher_email"]),
                "child_id": row["child_id"],
                "child_name": row["child_name"],
                "starts_at": row["starts_at"],
                "duration_minutes": int(row["duration_minutes"]),
                "modality": row["modality"],
                "booking_status": row["booking_status"],
                "amount_cents": int(row["amount_cents"] or 0),
                "currency": row["currency"],
                "created_at": row["created_at"],
            }
            for row in booking_rows
        ],
        "payments": [
            {
                "payment_order_id": row["payment_order_id"],
                "booking_id": row["booking_id"],
                "package_id": row["package_id"],
                "parent_id": row["parent_id"],
                "parent_name": _build_full_name(row["parent_first_name"], row["parent_last_name"], row["parent_email"]),
                "teacher_id": row["teacher_id"],
                "teacher_name": _build_full_name(
                    row["teacher_first_name"],
                    row["teacher_last_name"],
                    row["teacher_email"],
                )
                if row["teacher_id"]
                else None,
                "payment_method": row["payment_method"],
                "payment_status": row["payment_status"],
                "booking_status": row["booking_status"],
                "amount_cents": int(row["amount_cents"] or 0),
                "currency": row["currency"],
                "created_at": row["created_at"],
                "updated_at": row["updated_at"],
            }
            for row in payment_rows
        ],
        "reviews": [dict(row) for row in review_rows],
    }
