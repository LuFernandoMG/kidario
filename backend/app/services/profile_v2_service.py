from uuid import UUID, uuid4

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import AuthUser
from app.schemas.v2_profiles import (
    AddressInput,
    ChildCreateRequest,
    ChildUpdateRequest,
    MeUpdateRequest,
    ParentProfileUpdateRequest,
    TeacherProfileUpdateRequest,
)
from app.services.storage_url_service import resolve_teacher_profile_photo_url


class ProfileConflictError(Exception):
    pass


class ProfileValidationError(Exception):
    pass


class ProfileNotFoundError(Exception):
    pass


ADDRESS_FIELDS = (
    "street",
    "number",
    "complement",
    "district",
    "city",
    "state",
    "postal_code",
    "country",
    "latitude",
    "longitude",
)
ADDRESS_REQUIRED_FIELDS = ("street", "district", "city", "state")


def _mask_cpf(cpf: str | None) -> str | None:
    if not cpf:
        return None
    digits = "".join(ch for ch in cpf if ch.isdigit())
    if len(digits) >= 2:
        return f"***.***.***-{digits[-2:]}"
    return "***.***.***-**"


def _get_user(db: Session, user_id: str) -> dict:
    row = (
        db.execute(
            text(
                """
                select id, email, first_name, last_name, role, auth_email_confirmed, created_at, updated_at
                from users
                where id = :user_id
                """
            ),
            {"user_id": user_id},
        )
        .mappings()
        .first()
    )
    if not row:
        raise ProfileNotFoundError("User profile does not exist yet.")
    return dict(row)


def _split_email_name(email: str | None) -> tuple[str, str]:
    local = (email or "usuario").split("@", maxsplit=1)[0].strip() or "usuario"
    return local, ""


def ensure_user_v2(
    db: Session,
    user: AuthUser,
    *,
    target_role: str,
    first_name: str | None = None,
    last_name: str | None = None,
    auth_email_confirmed: bool = True,
) -> UUID:
    row = (
        db.execute(
            text(
                """
                select id, role
                from users
                where id = :user_id
                """
            ),
            {"user_id": user.user_id},
        )
        .mappings()
        .first()
    )
    fallback_first_name, fallback_last_name = _split_email_name(user.email)
    resolved_first_name = first_name if first_name is not None else fallback_first_name
    resolved_last_name = last_name if last_name is not None else fallback_last_name

    if row is None:
        if not user.email:
            raise ProfileValidationError("Token does not include email.")
        db.execute(
            text(
                """
                insert into users (id, email, first_name, last_name, role, auth_email_confirmed)
                values (:id, :email, :first_name, :last_name, :role, :auth_email_confirmed)
                """
            ),
            {
                "id": user.user_id,
                "email": user.email,
                "first_name": resolved_first_name,
                "last_name": resolved_last_name,
                "role": target_role,
                "auth_email_confirmed": auth_email_confirmed,
            },
        )
        return UUID(str(user.user_id))

    if row["role"] != target_role:
        raise ProfileConflictError(f"User already registered as role '{row['role']}'.")

    db.execute(
        text(
            """
            update users
            set
              first_name = coalesce(:first_name, first_name),
              last_name = coalesce(:last_name, last_name),
              auth_email_confirmed = auth_email_confirmed or :auth_email_confirmed,
              updated_at = now()
            where id = :id
            """
        ),
        {
            "id": user.user_id,
            "first_name": first_name,
            "last_name": last_name,
            "auth_email_confirmed": auth_email_confirmed,
        },
    )
    return UUID(str(user.user_id))


def _update_user_names(db: Session, user_id: str, first_name: str | None, last_name: str | None) -> None:
    if first_name is None and last_name is None:
        return
    db.execute(
        text(
            """
            update users
            set
              first_name = coalesce(:first_name, first_name),
              last_name = coalesce(:last_name, last_name),
              updated_at = now()
            where id = :user_id
            """
        ),
        {"user_id": user_id, "first_name": first_name, "last_name": last_name},
    )


def _load_address(db: Session, address_id: UUID | str) -> dict:
    row = (
        db.execute(
            text(
                """
                select
                  id, street, number, complement, district, city, state, postal_code,
                  country, latitude, longitude, created_at, updated_at
                from addresses
                where id = :address_id
                """
            ),
            {"address_id": str(address_id)},
        )
        .mappings()
        .first()
    )
    if not row:
        raise ProfileNotFoundError("Address does not exist.")
    return dict(row)


def _address_values(payload: AddressInput | None, existing: dict | None, *, required: bool) -> dict:
    existing = existing or {}
    provided = payload.model_fields_set if payload else set()
    values = {}
    for field in ADDRESS_FIELDS:
        if payload and field in provided:
            values[field] = getattr(payload, field)
        else:
            values[field] = existing.get(field)
    values["country"] = values.get("country") or "BR"

    missing = [field for field in ADDRESS_REQUIRED_FIELDS if not values.get(field)]
    if missing and required:
        raise ProfileValidationError(f"Address is missing required fields: {', '.join(missing)}.")
    return values


def _upsert_address(db: Session, address_id: UUID | str | None, payload: AddressInput | None) -> UUID:
    existing = _load_address(db, address_id) if address_id else None
    values = _address_values(payload, existing, required=existing is None)

    if existing:
        if payload is None:
            return UUID(str(existing["id"]))
        db.execute(
            text(
                """
                update addresses
                set
                  street = :street,
                  number = :number,
                  complement = :complement,
                  district = :district,
                  city = :city,
                  state = :state,
                  postal_code = :postal_code,
                  country = :country,
                  latitude = :latitude,
                  longitude = :longitude,
                  updated_at = now()
                where id = :id
                """
            ),
            {"id": str(existing["id"]), **values},
        )
        return UUID(str(existing["id"]))

    new_address_id = uuid4()
    db.execute(
        text(
            """
            insert into addresses (
              id, street, number, complement, district, city, state, postal_code,
              country, latitude, longitude
            )
            values (
              :id, :street, :number, :complement, :district, :city, :state, :postal_code,
              :country, :latitude, :longitude
            )
            """
        ),
        {"id": str(new_address_id), **values},
    )
    return new_address_id


def _get_role_profile_ids(db: Session, user_id: str) -> tuple[UUID | None, UUID | None]:
    row = (
        db.execute(
            text(
                """
                select p.id as parent_id, t.id as teacher_id
                from users u
                left join parents p on p.user_id = u.id
                left join teachers t on t.user_id = u.id
                where u.id = :user_id
                """
            ),
            {"user_id": user_id},
        )
        .mappings()
        .first()
    )
    if not row:
        raise ProfileNotFoundError("User profile does not exist yet.")
    return (
        UUID(str(row["parent_id"])) if row.get("parent_id") else None,
        UUID(str(row["teacher_id"])) if row.get("teacher_id") else None,
    )


def get_me_v2(db: Session, user: AuthUser) -> dict:
    user_row = _get_user(db, user.user_id)
    parent_id, teacher_id = _get_role_profile_ids(db, user.user_id)
    return {
        "user": user_row,
        "parent_id": parent_id,
        "teacher_id": teacher_id,
        "admin": {"is_admin": True} if user_row["role"] == "admin" else None,
    }


def update_me_v2(db: Session, user: AuthUser, payload: MeUpdateRequest) -> dict:
    _get_user(db, user.user_id)
    _update_user_names(db, user.user_id, payload.first_name, payload.last_name)
    return get_me_v2(db, user)


def _parent_row_for_user(db: Session, user_id: str) -> dict:
    user_row = _get_user(db, user_id)
    if user_row["role"] != "parent":
        raise ProfileConflictError(f"User is registered as role '{user_row['role']}'.")
    parent = (
        db.execute(
            text(
                """
                select id, user_id, address_id, phone, cpf, birth_date, bio, created_at, updated_at
                from parents
                where user_id = :user_id
                """
            ),
            {"user_id": user_id},
        )
        .mappings()
        .first()
    )
    if not parent:
        raise ProfileNotFoundError("Parent profile does not exist yet.")
    return dict(parent)


def _children_for_parent(db: Session, parent_id: UUID | str) -> list[dict]:
    rows = (
        db.execute(
            text(
                """
                select
                  id, parent_id, name, gender, birth_month_year, current_grade,
                  school, focus_points, created_at, updated_at
                from children
                where parent_id = :parent_id
                order by created_at asc
                """
            ),
            {"parent_id": str(parent_id)},
        )
        .mappings()
        .all()
    )
    return [dict(row) for row in rows]


def get_parent_profile_v2(db: Session, user: AuthUser) -> dict:
    user_row = _get_user(db, user.user_id)
    if user_row["role"] != "parent":
        raise ProfileConflictError(f"User is registered as role '{user_row['role']}'.")
    parent = _parent_row_for_user(db, user.user_id)
    address = _load_address(db, parent["address_id"])

    return {
        "id": parent["id"],
        "user": user_row,
        "phone": parent["phone"],
        "birth_date": parent["birth_date"],
        "cpf_masked": _mask_cpf(parent["cpf"]),
        "bio": parent["bio"],
        "address": address,
        "children": _children_for_parent(db, parent["id"]),
        "created_at": parent["created_at"],
        "updated_at": parent["updated_at"],
    }


def update_parent_profile_v2(db: Session, user: AuthUser, payload: ParentProfileUpdateRequest) -> dict:
    user_row = _get_user(db, user.user_id)
    if user_row["role"] != "parent":
        raise ProfileConflictError(f"User is registered as role '{user_row['role']}'.")

    existing_parent = (
        db.execute(text("select * from parents where user_id = :user_id"), {"user_id": user.user_id})
        .mappings()
        .first()
    )
    address_id = _upsert_address(db, existing_parent["address_id"] if existing_parent else None, payload.address)
    _update_user_names(db, user.user_id, payload.first_name, payload.last_name)

    provided = payload.model_fields_set
    values = {
        "phone": payload.phone if "phone" in provided else existing_parent["phone"] if existing_parent else None,
        "cpf": payload.cpf if "cpf" in provided else existing_parent["cpf"] if existing_parent else None,
        "birth_date": payload.birth_date
        if "birth_date" in provided
        else existing_parent["birth_date"]
        if existing_parent
        else None,
        "bio": payload.bio if "bio" in provided else existing_parent["bio"] if existing_parent else None,
    }
    missing = [field for field in ("phone", "cpf", "birth_date") if values.get(field) is None]
    if missing and existing_parent is None:
        raise ProfileValidationError(f"Parent profile is missing required fields: {', '.join(missing)}.")

    if existing_parent:
        db.execute(
            text(
                """
                update parents
                set phone = :phone,
                    cpf = :cpf,
                    birth_date = :birth_date,
                    bio = :bio,
                    address_id = :address_id,
                    updated_at = now()
                where id = :parent_id
                """
            ),
            {"parent_id": str(existing_parent["id"]), "address_id": str(address_id), **values},
        )
    else:
        db.execute(
            text(
                """
                insert into parents (id, user_id, address_id, phone, cpf, birth_date, bio)
                values (:id, :user_id, :address_id, :phone, :cpf, :birth_date, :bio)
                """
            ),
            {"id": str(uuid4()), "user_id": user.user_id, "address_id": str(address_id), **values},
        )

    return get_parent_profile_v2(db, user)


def list_my_children_v2(db: Session, user: AuthUser) -> dict:
    parent = _parent_row_for_user(db, user.user_id)
    return {"children": _children_for_parent(db, parent["id"])}


def create_child_v2(db: Session, user: AuthUser, payload: ChildCreateRequest) -> dict:
    parent = _parent_row_for_user(db, user.user_id)
    child_id = uuid4()
    row = (
        db.execute(
            text(
                """
                insert into children (
                  id, parent_id, name, gender, birth_month_year, current_grade, school, focus_points
                )
                values (
                  :id, :parent_id, :name, :gender, :birth_month_year, :current_grade, :school, :focus_points
                )
                returning
                  id, parent_id, name, gender, birth_month_year, current_grade,
                  school, focus_points, created_at, updated_at
                """
            ),
            {
                "id": str(child_id),
                "parent_id": str(parent["id"]),
                "name": payload.name,
                "gender": payload.gender,
                "birth_month_year": payload.birth_month_year,
                "current_grade": payload.current_grade,
                "school": payload.school,
                "focus_points": payload.focus_points,
            },
        )
        .mappings()
        .first()
    )
    return dict(row)


def update_child_v2(db: Session, user: AuthUser, child_id: UUID, payload: ChildUpdateRequest) -> dict:
    parent = _parent_row_for_user(db, user.user_id)
    existing = (
        db.execute(
            text(
                """
                select id, parent_id, name, gender, birth_month_year, current_grade, school, focus_points
                from children
                where id = :child_id and parent_id = :parent_id
                """
            ),
            {"child_id": str(child_id), "parent_id": str(parent["id"])},
        )
        .mappings()
        .first()
    )
    if not existing:
        raise ProfileNotFoundError("Child not found.")

    provided = payload.model_fields_set
    values = {
        "name": payload.name if "name" in provided else existing["name"],
        "gender": payload.gender if "gender" in provided else existing["gender"],
        "birth_month_year": payload.birth_month_year
        if "birth_month_year" in provided
        else existing["birth_month_year"],
        "current_grade": payload.current_grade if "current_grade" in provided else existing["current_grade"],
        "school": payload.school if "school" in provided else existing["school"],
        "focus_points": payload.focus_points if "focus_points" in provided else existing["focus_points"],
    }
    if not values["name"]:
        raise ProfileValidationError("Child name cannot be empty.")

    row = (
        db.execute(
            text(
                """
                update children
                set name = :name,
                    gender = :gender,
                    birth_month_year = :birth_month_year,
                    current_grade = :current_grade,
                    school = :school,
                    focus_points = :focus_points,
                    updated_at = now()
                where id = :child_id and parent_id = :parent_id
                returning
                  id, parent_id, name, gender, birth_month_year, current_grade,
                  school, focus_points, created_at, updated_at
                """
            ),
            {"child_id": str(child_id), "parent_id": str(parent["id"]), **values},
        )
        .mappings()
        .first()
    )
    return dict(row)


def delete_child_v2(db: Session, user: AuthUser, child_id: UUID) -> dict:
    parent = _parent_row_for_user(db, user.user_id)
    deleted = db.execute(
        text(
            """
            delete from children
            where id = :child_id and parent_id = :parent_id
            returning id
            """
        ),
        {"child_id": str(child_id), "parent_id": str(parent["id"])},
    ).scalar()
    if not deleted:
        raise ProfileNotFoundError("Child not found.")
    return {"status": "ok", "child_id": UUID(str(deleted))}


def _teacher_row_for_user(db: Session, user_id: str) -> dict:
    user_row = _get_user(db, user_id)
    if user_row["role"] != "teacher":
        raise ProfileConflictError(f"User is registered as role '{user_row['role']}'.")
    teacher = (
        db.execute(
            text(
                """
                select
                  id, user_id, address_id, phone, cpf, professional_number, modality, biography,
                  hourly_rate_cents, lesson_duration_minutes, profile_photo_file_name, hide_experience,
                  is_active, created_at, updated_at
                from teachers
                where user_id = :user_id
                """
            ),
            {"user_id": user_id},
        )
        .mappings()
        .first()
    )
    if not teacher:
        raise ProfileNotFoundError("Teacher profile does not exist yet.")
    return dict(teacher)


def get_teacher_profile_v2(db: Session, user: AuthUser) -> dict:
    settings = get_settings()
    user_row = _get_user(db, user.user_id)
    if user_row["role"] != "teacher":
        raise ProfileConflictError(f"User is registered as role '{user_row['role']}'.")
    teacher = _teacher_row_for_user(db, user.user_id)
    address = _load_address(db, teacher["address_id"])

    skill_rows = (
        db.execute(
            text(
                """
                select id, teacher_id, skill, created_at, updated_at
                from teacher_skills
                where teacher_id = :teacher_id
                order by skill asc
                """
            ),
            {"teacher_id": str(teacher["id"])},
        )
        .mappings()
        .all()
    )
    academic_rows = (
        db.execute(
            text(
                """
                select id, teacher_id, degree_type, course_name, institution, completion_year, created_at, updated_at
                from teacher_academic_records
                where teacher_id = :teacher_id
                order by created_at asc
                """
            ),
            {"teacher_id": str(teacher["id"])},
        )
        .mappings()
        .all()
    )
    experience_rows = (
        db.execute(
            text(
                """
                select
                  id, teacher_id, institution, role, coalesce(description, responsibilities) as description,
                  period_from, period_to, current_position, created_at, updated_at
                from teacher_experiences
                where teacher_id = :teacher_id
                order by created_at asc
                """
            ),
            {"teacher_id": str(teacher["id"])},
        )
        .mappings()
        .all()
    )
    availability_rows = (
        db.execute(
            text(
                """
                select id, teacher_id, day_of_week, start_time, end_time, created_at, updated_at
                from teacher_availability
                where teacher_id = :teacher_id
                order by day_of_week asc, start_time asc
                """
            ),
            {"teacher_id": str(teacher["id"])},
        )
        .mappings()
        .all()
    )

    return {
        "id": teacher["id"],
        "user": user_row,
        "phone": teacher["phone"],
        "cpf_masked": _mask_cpf(teacher["cpf"]),
        "professional_number": teacher["professional_number"],
        "modality": teacher["modality"],
        "biography": teacher["biography"],
        "hourly_rate_cents": teacher["hourly_rate_cents"],
        "lesson_duration_minutes": teacher["lesson_duration_minutes"],
        "profile_photo_file_name": teacher["profile_photo_file_name"],
        "profile_photo_url": resolve_teacher_profile_photo_url(settings, teacher["profile_photo_file_name"]),
        "hide_experience": teacher["hide_experience"],
        "is_active": teacher["is_active"],
        "address": address,
        "skills": [dict(row) for row in skill_rows],
        "academic_records": [dict(row) for row in academic_rows],
        "experiences": [dict(row) for row in experience_rows],
        "availability": [dict(row) for row in availability_rows],
        "created_at": teacher["created_at"],
        "updated_at": teacher["updated_at"],
    }


def update_teacher_profile_v2(db: Session, user: AuthUser, payload: TeacherProfileUpdateRequest) -> dict:
    user_row = _get_user(db, user.user_id)
    if user_row["role"] != "teacher":
        raise ProfileConflictError(f"User is registered as role '{user_row['role']}'.")

    existing_teacher = (
        db.execute(text("select * from teachers where user_id = :user_id"), {"user_id": user.user_id})
        .mappings()
        .first()
    )
    address_id = _upsert_address(db, existing_teacher["address_id"] if existing_teacher else None, payload.address)
    _update_user_names(db, user.user_id, payload.first_name, payload.last_name)

    provided = payload.model_fields_set
    values = {
        "phone": payload.phone if "phone" in provided else existing_teacher["phone"] if existing_teacher else None,
        "cpf": payload.cpf if "cpf" in provided else existing_teacher["cpf"] if existing_teacher else None,
        "professional_number": payload.professional_number
        if "professional_number" in provided
        else existing_teacher["professional_number"]
        if existing_teacher
        else None,
        "modality": payload.modality
        if "modality" in provided
        else existing_teacher["modality"]
        if existing_teacher
        else None,
        "biography": payload.biography
        if "biography" in provided
        else existing_teacher["biography"]
        if existing_teacher
        else None,
        "hourly_rate_cents": payload.hourly_rate_cents
        if "hourly_rate_cents" in provided
        else existing_teacher["hourly_rate_cents"]
        if existing_teacher
        else None,
        "lesson_duration_minutes": payload.lesson_duration_minutes
        if "lesson_duration_minutes" in provided
        else existing_teacher["lesson_duration_minutes"]
        if existing_teacher
        else None,
        "profile_photo_file_name": payload.profile_photo_file_name
        if "profile_photo_file_name" in provided
        else existing_teacher["profile_photo_file_name"]
        if existing_teacher
        else None,
        "hide_experience": payload.hide_experience
        if "hide_experience" in provided
        else existing_teacher["hide_experience"]
        if existing_teacher
        else False,
    }
    if values["cpf"] is None and existing_teacher is None:
        raise ProfileValidationError("Teacher profile is missing required field: cpf.")

    teacher_id = UUID(str(existing_teacher["id"])) if existing_teacher else uuid4()

    if existing_teacher:
        db.execute(
            text(
                """
                update teachers
                set phone = :phone,
                    cpf = :cpf,
                    professional_number = :professional_number,
                    address_id = :address_id,
                    modality = :modality,
                    biography = :biography,
                    hourly_rate_cents = :hourly_rate_cents,
                    lesson_duration_minutes = :lesson_duration_minutes,
                    profile_photo_file_name = :profile_photo_file_name,
                    hide_experience = :hide_experience,
                    updated_at = now()
                where id = :teacher_id
                """
            ),
            {"teacher_id": str(teacher_id), "address_id": str(address_id), **values},
        )
    else:
        db.execute(
            text(
                """
                insert into teachers (
                  id, user_id, address_id, phone, cpf, professional_number, modality, biography,
                  hourly_rate_cents, lesson_duration_minutes, profile_photo_file_name, hide_experience
                )
                values (
                  :id, :user_id, :address_id, :phone, :cpf, :professional_number, :modality, :biography,
                  :hourly_rate_cents, :lesson_duration_minutes, :profile_photo_file_name, :hide_experience
                )
                """
            ),
            {"id": str(teacher_id), "user_id": user.user_id, "address_id": str(address_id), **values},
        )

    if payload.skills_ops:
        for skill in payload.skills_ops.remove:
            db.execute(
                text(
                    """
                    delete from teacher_skills
                    where teacher_id = :teacher_id and lower(skill) = lower(:skill)
                    """
                ),
                {"teacher_id": str(teacher_id), "skill": skill},
            )
        for skill in payload.skills_ops.add:
            normalized_skill = skill.strip()
            if not normalized_skill:
                continue
            exists = db.execute(
                text(
                    """
                    select exists(
                      select 1 from teacher_skills
                      where teacher_id = :teacher_id and lower(skill) = lower(:skill)
                    )
                    """
                ),
                {"teacher_id": str(teacher_id), "skill": normalized_skill},
            ).scalar_one()
            if not exists:
                db.execute(
                    text(
                        """
                        insert into teacher_skills (id, teacher_id, skill)
                        values (:id, :teacher_id, :skill)
                        """
                    ),
                    {"id": str(uuid4()), "teacher_id": str(teacher_id), "skill": normalized_skill},
                )

    if payload.academic_records_ops:
        for record_id in payload.academic_records_ops.delete_ids:
            db.execute(
                text("delete from teacher_academic_records where id = :id and teacher_id = :teacher_id"),
                {"id": str(record_id), "teacher_id": str(teacher_id)},
            )
        for record in payload.academic_records_ops.upsert:
            record_id = record.id or uuid4()
            exists = db.execute(
                text("select exists(select 1 from teacher_academic_records where id = :id and teacher_id = :teacher_id)"),
                {"id": str(record_id), "teacher_id": str(teacher_id)},
            ).scalar_one()
            params = {
                "id": str(record_id),
                "teacher_id": str(teacher_id),
                "degree_type": record.degree_type,
                "course_name": record.course_name,
                "institution": record.institution,
                "completion_year": record.completion_year,
            }
            if exists:
                db.execute(
                    text(
                        """
                        update teacher_academic_records
                        set degree_type = :degree_type,
                            course_name = :course_name,
                            institution = :institution,
                            completion_year = :completion_year,
                            updated_at = now()
                        where id = :id and teacher_id = :teacher_id
                        """
                    ),
                    params,
                )
            else:
                db.execute(
                    text(
                        """
                        insert into teacher_academic_records
                          (id, teacher_id, degree_type, course_name, institution, completion_year)
                        values
                          (:id, :teacher_id, :degree_type, :course_name, :institution, :completion_year)
                        """
                    ),
                    params,
                )

    if payload.experiences_ops:
        for experience_id in payload.experiences_ops.delete_ids:
            db.execute(
                text("delete from teacher_experiences where id = :id and teacher_id = :teacher_id"),
                {"id": str(experience_id), "teacher_id": str(teacher_id)},
            )
        for experience in payload.experiences_ops.upsert:
            experience_id = experience.id or uuid4()
            exists = db.execute(
                text("select exists(select 1 from teacher_experiences where id = :id and teacher_id = :teacher_id)"),
                {"id": str(experience_id), "teacher_id": str(teacher_id)},
            ).scalar_one()
            params = {
                "id": str(experience_id),
                "teacher_id": str(teacher_id),
                "institution": experience.institution,
                "role": experience.role,
                "description": experience.description,
                "period_from": experience.period_from,
                "period_to": experience.period_to,
                "current_position": experience.current_position,
            }
            if exists:
                db.execute(
                    text(
                        """
                        update teacher_experiences
                        set institution = :institution,
                            role = :role,
                            responsibilities = :description,
                            description = :description,
                            period_from = :period_from,
                            period_to = :period_to,
                            current_position = :current_position,
                            updated_at = now()
                        where id = :id and teacher_id = :teacher_id
                        """
                    ),
                    params,
                )
            else:
                db.execute(
                    text(
                        """
                        insert into teacher_experiences
                          (
                            id, teacher_id, institution, role, description,
                            period_from, period_to, current_position
                          )
                        values
                          (
                            :id, :teacher_id, :institution, :role, :description,
                            :period_from, :period_to, :current_position
                          )
                        """
                    ),
                    params,
                )

    if payload.availability_ops:
        for availability_id in payload.availability_ops.delete_ids:
            db.execute(
                text("delete from teacher_availability where id = :id and teacher_id = :teacher_id"),
                {"id": str(availability_id), "teacher_id": str(teacher_id)},
            )
        for slot in payload.availability_ops.upsert:
            slot_id = slot.id or uuid4()
            exists = db.execute(
                text("select exists(select 1 from teacher_availability where id = :id and teacher_id = :teacher_id)"),
                {"id": str(slot_id), "teacher_id": str(teacher_id)},
            ).scalar_one()
            params = {
                "id": str(slot_id),
                "teacher_id": str(teacher_id),
                "day_of_week": slot.day_of_week,
                "start_time": slot.start_time,
                "end_time": slot.end_time,
            }
            if exists:
                db.execute(
                    text(
                        """
                        update teacher_availability
                        set day_of_week = :day_of_week,
                            start_time = :start_time,
                            end_time = :end_time,
                            updated_at = now()
                        where id = :id and teacher_id = :teacher_id
                        """
                    ),
                    params,
                )
            else:
                db.execute(
                    text(
                        """
                        insert into teacher_availability
                          (id, teacher_id, day_of_week, start_time, end_time)
                        values
                          (:id, :teacher_id, :day_of_week, :start_time, :end_time)
                        """
                    ),
                    params,
                )

    return get_teacher_profile_v2(db, user)


def set_teacher_activation_v2(db: Session, teacher_id: UUID, is_active: bool) -> dict:
    row = (
        db.execute(
            text(
                """
                update teachers
                set is_active = :is_active, updated_at = now()
                where id = :teacher_id
                returning id, is_active
                """
            ),
            {"teacher_id": str(teacher_id), "is_active": is_active},
        )
        .mappings()
        .first()
    )
    if not row:
        raise ProfileNotFoundError("Teacher profile not found.")
    return {
        "status": "ok",
        "teacher_id": UUID(str(row["id"])),
        "is_active": bool(row["is_active"]),
    }
