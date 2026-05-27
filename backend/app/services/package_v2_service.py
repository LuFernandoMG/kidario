from uuid import UUID, uuid4

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import AuthUser
from app.schemas.v2_packages import PackagePlanCreateRequest, PackagePlanUpdateRequest, PackagePurchaseCreateRequest
from app.services.booking_v2_service import _map_payment_order
from app.services.identity_service import (
    IdentityNotFoundError,
    IdentityPermissionError,
    require_user_role,
    resolve_parent_id,
    resolve_teacher_id,
)


class PackageValidationError(Exception):
    pass


class PackageConflictError(Exception):
    pass


class PackageNotFoundError(Exception):
    pass


class PackagePermissionError(Exception):
    pass


def _require_teacher(db: Session, user: AuthUser) -> UUID:
    try:
        require_user_role(db, user.user_id, "teacher")
        return resolve_teacher_id(db, user.user_id)
    except IdentityNotFoundError as exc:
        raise PackagePermissionError(str(exc)) from exc
    except IdentityPermissionError as exc:
        raise PackagePermissionError("Only teacher users can manage package plans.") from exc


def _require_parent(db: Session, user: AuthUser) -> UUID:
    try:
        require_user_role(db, user.user_id, "parent")
        return resolve_parent_id(db, user.user_id)
    except IdentityNotFoundError as exc:
        raise PackagePermissionError(str(exc)) from exc
    except IdentityPermissionError as exc:
        raise PackagePermissionError("Only parent users can purchase packages.") from exc


def _estimate_amounts(row: dict) -> dict:
    hourly_rate = row.get("hourly_rate_cents")
    lesson_duration = row.get("lesson_duration_minutes")
    if hourly_rate is None or lesson_duration is None:
        return {"estimated_original_amount_cents": None, "estimated_final_amount_cents": None}
    unit = round(int(hourly_rate) * (int(lesson_duration) / 60))
    original = unit * int(row["sessions_count"])
    discount = float(row["discount_percent"] or 0)
    return {
        "estimated_original_amount_cents": original,
        "estimated_final_amount_cents": round(original * (1 - discount / 100)),
    }


def _map_package_plan(row: dict) -> dict:
    estimates = _estimate_amounts(row)
    return {
        "id": row["id"],
        "teacher_id": row["teacher_id"],
        "code": row["code"],
        "name": row["name"],
        "description": row["description"],
        "sessions_count": row["sessions_count"],
        "discount_percent": float(row["discount_percent"] or 0),
        "is_active": row["is_active"],
        "estimated_original_amount_cents": estimates["estimated_original_amount_cents"],
        "estimated_final_amount_cents": estimates["estimated_final_amount_cents"],
        "currency": "BRL",
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def _load_package_plan(db: Session, package_plan_id: UUID) -> dict:
    row = (
        db.execute(
            text(
                """
                select
                  pp.id,
                  pp.teacher_id,
                  pp.code,
                  pp.name,
                  pp.description,
                  pp.sessions_count,
                  pp.discount_percent,
                  pp.is_active,
                  pp.created_at,
                  pp.updated_at,
                  t.hourly_rate_cents,
                  coalesce(t.lesson_duration_minutes, 60) as lesson_duration_minutes
                from package_plans pp
                join teachers t on t.id = pp.teacher_id
                where pp.id = :package_plan_id
                """
            ),
            {"package_plan_id": str(package_plan_id)},
        )
        .mappings()
        .first()
    )
    if not row:
        raise PackageNotFoundError("Package plan not found.")
    return dict(row)


def list_my_package_plans_v2(db: Session, user: AuthUser) -> dict:
    teacher_id = _require_teacher(db, user)
    rows = (
        db.execute(
            text(
                """
                select
                  pp.id,
                  pp.teacher_id,
                  pp.code,
                  pp.name,
                  pp.description,
                  pp.sessions_count,
                  pp.discount_percent,
                  pp.is_active,
                  pp.created_at,
                  pp.updated_at,
                  t.hourly_rate_cents,
                  coalesce(t.lesson_duration_minutes, 60) as lesson_duration_minutes
                from package_plans pp
                join teachers t on t.id = pp.teacher_id
                where pp.teacher_id = :teacher_id
                order by pp.is_active desc, pp.sessions_count asc, pp.name asc
                """
            ),
            {"teacher_id": str(teacher_id)},
        )
        .mappings()
        .all()
    )
    return {"package_plans": [_map_package_plan(dict(row)) for row in rows]}


def create_my_package_plan_v2(db: Session, user: AuthUser, payload: PackagePlanCreateRequest) -> dict:
    teacher_id = _require_teacher(db, user)
    try:
        row = (
            db.execute(
                text(
                    """
                    insert into package_plans (
                      id, teacher_id, code, name, description, sessions_count, discount_percent, is_active
                    )
                    values (
                      :id, :teacher_id, :code, :name, :description, :sessions_count, :discount_percent, :is_active
                    )
                    returning id
                    """
                ),
                {
                    "id": str(uuid4()),
                    "teacher_id": str(teacher_id),
                    "code": payload.code.strip(),
                    "name": payload.name.strip(),
                    "description": payload.description,
                    "sessions_count": payload.sessions_count,
                    "discount_percent": payload.discount_percent,
                    "is_active": payload.is_active,
                },
            )
            .mappings()
            .first()
        )
    except IntegrityError as exc:
        sqlstate = getattr(getattr(exc, "orig", None), "sqlstate", None)
        if sqlstate == "23505":
            raise PackageConflictError("Teacher already has a package plan with this code.") from exc
        raise
    return _map_package_plan(_load_package_plan(db, UUID(str(row["id"]))))


def update_my_package_plan_v2(
    db: Session,
    user: AuthUser,
    package_plan_id: UUID,
    payload: PackagePlanUpdateRequest,
) -> dict:
    teacher_id = _require_teacher(db, user)
    existing = _load_package_plan(db, package_plan_id)
    if str(existing["teacher_id"]) != str(teacher_id):
        raise PackagePermissionError("Only the teacher owner can update this package plan.")

    provided = payload.model_fields_set
    values = {
        "code": payload.code.strip() if "code" in provided and payload.code is not None else existing["code"],
        "name": payload.name.strip() if "name" in provided and payload.name is not None else existing["name"],
        "description": payload.description if "description" in provided else existing["description"],
        "sessions_count": payload.sessions_count if "sessions_count" in provided else existing["sessions_count"],
        "discount_percent": payload.discount_percent if "discount_percent" in provided else existing["discount_percent"],
        "is_active": payload.is_active if "is_active" in provided else existing["is_active"],
    }
    try:
        db.execute(
            text(
                """
                update package_plans
                set code = :code,
                    name = :name,
                    description = :description,
                    sessions_count = :sessions_count,
                    discount_percent = :discount_percent,
                    is_active = :is_active,
                    updated_at = now()
                where id = :package_plan_id and teacher_id = :teacher_id
                """
            ),
            {
                "package_plan_id": str(package_plan_id),
                "teacher_id": str(teacher_id),
                **values,
            },
        )
    except IntegrityError as exc:
        sqlstate = getattr(getattr(exc, "orig", None), "sqlstate", None)
        if sqlstate == "23505":
            raise PackageConflictError("Teacher already has a package plan with this code.") from exc
        raise
    return _map_package_plan(_load_package_plan(db, package_plan_id))


def _resolve_child(db: Session, parent_id: UUID, child_id: UUID) -> UUID:
    exists = db.execute(
        text("select exists(select 1 from children where id = :child_id and parent_id = :parent_id)"),
        {"child_id": str(child_id), "parent_id": str(parent_id)},
    ).scalar_one()
    if not exists:
        raise PackageValidationError("child_id does not belong to the authenticated parent.")
    return child_id


def _load_booking_package(db: Session, package_id: UUID) -> dict:
    row = (
        db.execute(
            text(
                """
                select
                  bp.id,
                  bp.package_plan_id,
                  bp.teacher_id,
                  bp.parent_id,
                  bp.child_id,
                  bp.total_sessions,
                  bp.original_unit_amount_cents,
                  bp.original_amount_cents,
                  bp.discount_percent,
                  bp.discount_amount_cents,
                  bp.final_amount_cents,
                  bp.currency,
                  bp.status,
                  bp.valid_from,
                  bp.expires_at,
                  bp.created_at,
                  bp.updated_at
                from booking_packages bp
                where bp.id = :package_id
                """
            ),
            {"package_id": str(package_id)},
        )
        .mappings()
        .first()
    )
    if not row:
        raise PackageNotFoundError("Package purchase not found.")
    package_row = dict(row)
    counters = (
        db.execute(
            text(
                """
                select
                  count(*) filter (where status <> 'cancelada') as booked_sessions,
                  count(*) filter (where status = 'concluida') as completed_sessions
                from bookings
                where package_id = :package_id
                """
            ),
            {"package_id": str(package_id)},
        )
        .mappings()
        .first()
    )
    payment = (
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
                where package_id = :package_id
                order by created_at desc
                limit 1
                """
            ),
            {"package_id": str(package_id)},
        )
        .mappings()
        .first()
    )
    package_row["discount_percent"] = float(package_row["discount_percent"] or 0)
    booked_sessions = int(counters["booked_sessions"] or 0) if counters else 0
    completed_sessions = int(counters["completed_sessions"] or 0) if counters else 0
    package_row["booked_sessions"] = booked_sessions
    package_row["completed_sessions"] = completed_sessions
    package_row["remaining_sessions"] = max(int(package_row["total_sessions"]) - booked_sessions, 0)
    package_row["payment_order"] = _map_payment_order(db, dict(payment)) if payment else None
    return package_row


def create_package_purchase_v2(db: Session, user: AuthUser, payload: PackagePurchaseCreateRequest) -> dict:
    parent_id = _require_parent(db, user)
    child_id = _resolve_child(db, parent_id, payload.child_id)
    plan = _load_package_plan(db, payload.package_plan_id)
    if not plan["is_active"]:
        raise PackageValidationError("Package plan is not active.")
    if plan["hourly_rate_cents"] is None:
        raise PackageValidationError("Teacher hourly rate is required to purchase a package.")

    unit_amount = round(int(plan["hourly_rate_cents"]) * (int(plan["lesson_duration_minutes"] or 60) / 60))
    original_amount = unit_amount * int(plan["sessions_count"])
    discount_percent = float(plan["discount_percent"] or 0)
    final_amount = round(original_amount * (1 - discount_percent / 100))
    discount_amount = original_amount - final_amount
    package_id = uuid4()
    payment_order_id = uuid4()
    payment_charge_id = uuid4()

    package_row = (
        db.execute(
            text(
                """
                insert into booking_packages (
                  id,
                  package_plan_id,
                  teacher_id,
                  parent_id,
                  child_id,
                  total_sessions,
                  original_unit_amount_cents,
                  original_amount_cents,
                  discount_percent,
                  discount_amount_cents,
                  final_amount_cents,
                  currency,
                  status
                )
                values (
                  :id,
                  :package_plan_id,
                  :teacher_id,
                  :parent_id,
                  :child_id,
                  :total_sessions,
                  :original_unit_amount_cents,
                  :original_amount_cents,
                  :discount_percent,
                  :discount_amount_cents,
                  :final_amount_cents,
                  'BRL',
                  'pending_payment'
                )
                returning id
                """
            ),
            {
                "id": str(package_id),
                "package_plan_id": str(payload.package_plan_id),
                "teacher_id": str(plan["teacher_id"]),
                "parent_id": str(parent_id),
                "child_id": str(child_id),
                "total_sessions": plan["sessions_count"],
                "original_unit_amount_cents": unit_amount,
                "original_amount_cents": original_amount,
                "discount_percent": discount_percent,
                "discount_amount_cents": discount_amount,
                "final_amount_cents": final_amount,
            },
        )
        .mappings()
        .first()
    )
    if not package_row:
        raise PackageValidationError("Could not create package purchase.")

    db.execute(
        text(
            """
            insert into payment_orders (
              id, parent_id, package_id, provider, amount_cents, currency, status
            )
            values (
              :id, :parent_id, :package_id, 'legacy', :amount_cents, 'BRL', 'pending'
            )
            """
        ),
        {
            "id": str(payment_order_id),
            "parent_id": str(parent_id),
            "package_id": str(package_id),
            "amount_cents": final_amount,
        },
    )
    db.execute(
        text(
            """
            insert into payment_charges (
              id, payment_order_id, provider, payment_method, status, amount_cents
            )
            values (
              :id, :payment_order_id, 'legacy', :payment_method, 'pending', :amount_cents
            )
            """
        ),
        {
            "id": str(payment_charge_id),
            "payment_order_id": str(payment_order_id),
            "payment_method": payload.payment_method,
            "amount_cents": final_amount,
        },
    )

    return _load_booking_package(db, package_id)


def list_parent_packages_v2(db: Session, user: AuthUser) -> dict:
    parent_id = _require_parent(db, user)
    rows = (
        db.execute(
            text(
                """
                select id
                from booking_packages
                where parent_id = :parent_id
                order by created_at desc
                """
            ),
            {"parent_id": str(parent_id)},
        )
        .mappings()
        .all()
    )
    return {"packages": [_load_booking_package(db, UUID(str(row["id"]))) for row in rows]}


def list_teacher_packages_v2(db: Session, user: AuthUser) -> dict:
    teacher_id = _require_teacher(db, user)
    rows = (
        db.execute(
            text(
                """
                select id
                from booking_packages
                where teacher_id = :teacher_id
                order by created_at desc
                """
            ),
            {"teacher_id": str(teacher_id)},
        )
        .mappings()
        .all()
    )
    return {"packages": [_load_booking_package(db, UUID(str(row["id"]))) for row in rows]}
