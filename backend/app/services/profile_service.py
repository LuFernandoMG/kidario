from uuid import UUID, uuid4

from sqlalchemy import bindparam, text
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import AuthUser
from app.schemas.profiles import AddressPatch, ParentProfilePatch, TeacherProfilePatch
from app.services.storage_url_service import resolve_teacher_profile_photo_url


class ProfileConflictError(Exception):
    pass


class ProfileValidationError(Exception):
    pass


class ProfileNotFoundError(Exception):
    pass


def _get_user_row(db: Session, user_id: str):
    return (
        db.execute(
            text(
                """
                select id, email, first_name, last_name, role, auth_email_confirmed
                from users
                where id = :user_id
                """
            ),
            {"user_id": user_id},
        )
        .mappings()
        .first()
    )


def _split_email_name(email: str | None) -> tuple[str, str]:
    local = (email or "usuario").split("@", maxsplit=1)[0].strip() or "usuario"
    return local, ""


def _ensure_user(
    db: Session,
    user: AuthUser,
    target_role: str,
    first_name: str | None,
    last_name: str | None,
) -> UUID:
    row = _get_user_row(db, user.user_id)
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
                values (:id, :email, :first_name, :last_name, :role, true)
                """
            ),
            {
                "id": user.user_id,
                "email": user.email,
                "first_name": resolved_first_name,
                "last_name": resolved_last_name,
                "role": target_role,
            },
        )
        return UUID(user.user_id)

    if row["role"] != target_role:
        raise ProfileConflictError(f"User already registered as role '{row['role']}'.")

    db.execute(
        text(
            """
            update users
            set
              first_name = coalesce(:first_name, first_name),
              last_name = coalesce(:last_name, last_name),
              updated_at = now()
            where id = :id
            """
        ),
        {"id": user.user_id, "first_name": first_name, "last_name": last_name},
    )
    return UUID(user.user_id)


def _address_payload(payload: AddressPatch | None, existing: dict | None = None) -> dict:
    existing = existing or {}
    return {
        "street": payload.street if payload and payload.street is not None else existing.get("street"),
        "number": payload.number if payload and payload.number is not None else existing.get("number"),
        "complement": payload.complement if payload and payload.complement is not None else existing.get("complement"),
        "district": payload.district if payload and payload.district is not None else existing.get("district"),
        "city": payload.city if payload and payload.city is not None else existing.get("city"),
        "state": payload.state if payload and payload.state is not None else existing.get("state"),
        "postal_code": payload.postal_code if payload and payload.postal_code is not None else existing.get("postal_code"),
        "country": payload.country if payload and payload.country is not None else existing.get("country") or "BR",
        "latitude": payload.latitude if payload and payload.latitude is not None else existing.get("latitude"),
        "longitude": payload.longitude if payload and payload.longitude is not None else existing.get("longitude"),
    }


def _load_address(db: Session, address_id: UUID | str | None) -> dict | None:
    if not address_id:
        return None
    row = (
        db.execute(
            text(
                """
                select id, street, number, complement, district, city, state, postal_code, country, latitude, longitude
                from addresses
                where id = :address_id
                """
            ),
            {"address_id": str(address_id)},
        )
        .mappings()
        .first()
    )
    return dict(row) if row else None


def _upsert_address(
    db: Session,
    *,
    address_id: UUID | str | None,
    payload: AddressPatch | None,
    required_for_create: bool,
) -> UUID:
    existing = _load_address(db, address_id)
    if existing and payload is None:
        return UUID(str(existing["id"]))

    values = _address_payload(payload, existing)
    missing = [field for field in ("street", "district", "city", "state") if not values.get(field)]
    if missing and (required_for_create or existing is None):
        raise ProfileValidationError(f"Address is missing required fields: {', '.join(missing)}.")

    if existing:
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
              id, street, number, complement, district, city, state, postal_code, country, latitude, longitude
            )
            values (
              :id, :street, :number, :complement, :district, :city, :state, :postal_code, :country, :latitude, :longitude
            )
            """
        ),
        {"id": str(new_address_id), **values},
    )
    return new_address_id


def _load_user_parent_teacher_ids(db: Session, user_id: str) -> tuple[UUID | None, UUID | None]:
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


def get_me(db: Session, user: AuthUser) -> dict:
    user_row = _get_user_row(db, user.user_id)
    if not user_row:
        raise ProfileNotFoundError("User profile does not exist yet.")

    parent_id, teacher_id = _load_user_parent_teacher_ids(db, user.user_id)
    return {
        "user": dict(user_row),
        "role": user_row["role"],
        "parent_id": parent_id,
        "teacher_id": teacher_id,
    }


def get_parent_profile(db: Session, user: AuthUser) -> dict:
    user_row = _get_user_row(db, user.user_id)
    if not user_row:
        raise ProfileNotFoundError("User profile does not exist yet.")
    if user_row["role"] != "parent":
        raise ProfileConflictError(f"User already registered as role '{user_row['role']}'.")

    parent = (
        db.execute(
            text(
                """
                select id, user_id, address_id, phone, cpf, birth_date, bio
                from parents
                where user_id = :user_id
                """
            ),
            {"user_id": user.user_id},
        )
        .mappings()
        .first()
    )
    if not parent:
        raise ProfileNotFoundError("Parent profile does not exist yet.")

    address = _load_address(db, parent["address_id"])
    if not address:
        raise ProfileNotFoundError("Parent address does not exist.")

    children = (
        db.execute(
            text(
                """
                select id, parent_id, name, gender, birth_month_year, current_grade, school, focus_points
                from children
                where parent_id = :parent_id
                order by created_at asc
                """
            ),
            {"parent_id": str(parent["id"])},
        )
        .mappings()
        .all()
    )

    return {
        "user": dict(user_row),
        "parent": dict(parent),
        "address": address,
        "children": [dict(child) for child in children],
    }


def get_teacher_profile(db: Session, user: AuthUser) -> dict:
    settings = get_settings()
    user_row = _get_user_row(db, user.user_id)
    if not user_row:
        raise ProfileNotFoundError("User profile does not exist yet.")
    if user_row["role"] != "teacher":
        raise ProfileConflictError(f"User already registered as role '{user_row['role']}'.")

    teacher = (
        db.execute(
            text(
                """
                select
                  id,
                  user_id,
                  address_id,
                  phone,
                  cpf,
                  professional_number,
                  modality,
                  biography,
                  hourly_rate_cents,
                  lesson_duration_minutes,
                  profile_photo_file_name,
                  hide_experience,
                  is_active
                from teachers
                where user_id = :user_id
                """
            ),
            {"user_id": user.user_id},
        )
        .mappings()
        .first()
    )
    if not teacher:
        raise ProfileNotFoundError("Teacher profile does not exist yet.")

    teacher_dict = dict(teacher)
    teacher_dict["profile_photo_file_name"] = resolve_teacher_profile_photo_url(
        settings,
        teacher_dict["profile_photo_file_name"],
    )

    address = _load_address(db, teacher["address_id"])
    if not address:
        raise ProfileNotFoundError("Teacher address does not exist.")

    skills_rows = (
        db.execute(
            text(
                """
                select skill
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
                select id, teacher_id, degree_type, course_name, institution, completion_year
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
                select id, teacher_id, institution, role, coalesce(description, responsibilities) as description,
                       period_from, period_to, current_position
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
                select id, teacher_id, day_of_week, start_time, end_time
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
        "user": dict(user_row),
        "teacher": teacher_dict,
        "address": address,
        "skills": [str(item["skill"]) for item in skills_rows],
        "academic_records": [dict(item) for item in academic_rows],
        "experiences": [dict(item) for item in experience_rows],
        "availability": [dict(item) for item in availability_rows],
    }


def patch_parent_profile(db: Session, user: AuthUser, payload: ParentProfilePatch) -> dict:
    user_id = _ensure_user(
        db,
        user,
        target_role="parent",
        first_name=payload.first_name,
        last_name=payload.last_name,
    )

    existing_parent = (
        db.execute(
            text("select * from parents where user_id = :user_id"),
            {"user_id": str(user_id)},
        )
        .mappings()
        .first()
    )

    address_id = _upsert_address(
        db,
        address_id=existing_parent["address_id"] if existing_parent else None,
        payload=payload.address,
        required_for_create=existing_parent is None,
    )

    values = {
        "phone": payload.phone if payload.phone is not None else existing_parent["phone"] if existing_parent else None,
        "cpf": payload.cpf if payload.cpf is not None else existing_parent["cpf"] if existing_parent else None,
        "birth_date": payload.birth_date
        if payload.birth_date is not None
        else existing_parent["birth_date"]
        if existing_parent
        else None,
        "bio": payload.bio if payload.bio is not None else existing_parent["bio"] if existing_parent else None,
    }
    missing = [field for field in ("phone", "cpf", "birth_date") if values.get(field) is None]
    if missing and existing_parent is None:
        raise ProfileValidationError(f"Parent profile is missing required fields: {', '.join(missing)}.")

    if existing_parent:
        db.execute(
            text(
                """
                update parents
                set phone = :phone, cpf = :cpf, birth_date = :birth_date, address_id = :address_id, bio = :bio, updated_at = now()
                where id = :parent_id
                """
            ),
            {"parent_id": str(existing_parent["id"]), "address_id": str(address_id), **values},
        )
        parent_id = UUID(str(existing_parent["id"]))
    else:
        parent_id = uuid4()
        db.execute(
            text(
                """
                insert into parents (id, user_id, address_id, phone, cpf, birth_date, bio)
                values (:id, :user_id, :address_id, :phone, :cpf, :birth_date, :bio)
                """
            ),
            {"id": str(parent_id), "user_id": str(user_id), "address_id": str(address_id), **values},
        )

    if payload.children_ops:
        if payload.children_ops.delete_ids:
            delete_stmt = text(
                """
                delete from children
                where parent_id = :parent_id and id in :ids
                """
            ).bindparams(bindparam("ids", expanding=True))
            db.execute(
                delete_stmt,
                {
                    "parent_id": str(parent_id),
                    "ids": [str(child_id) for child_id in payload.children_ops.delete_ids],
                },
            )

        for child in payload.children_ops.upsert:
            child_id = child.id or uuid4()
            exists = db.execute(
                text(
                    """
                    select exists(select 1 from children where id = :id and parent_id = :parent_id)
                    """
                ),
                {"id": str(child_id), "parent_id": str(parent_id)},
            ).scalar_one()
            params = {
                "id": str(child_id),
                "parent_id": str(parent_id),
                "name": child.name,
                "gender": child.gender,
                "birth_month_year": child.birth_month_year,
                "current_grade": child.current_grade,
                "school": child.school,
                "focus_points": child.focus_points,
            }
            if exists:
                db.execute(
                    text(
                        """
                        update children
                        set
                          name = :name,
                          gender = :gender,
                          birth_month_year = :birth_month_year,
                          current_grade = :current_grade,
                          school = :school,
                          focus_points = :focus_points,
                          updated_at = now()
                        where id = :id and parent_id = :parent_id
                        """
                    ),
                    params,
                )
            else:
                db.execute(
                    text(
                        """
                        insert into children
                          (id, parent_id, name, gender, birth_month_year, current_grade, school, focus_points)
                        values
                          (:id, :parent_id, :name, :gender, :birth_month_year, :current_grade, :school, :focus_points)
                        """
                    ),
                    params,
                )

    children_count = db.execute(
        text("select count(*) from children where parent_id = :parent_id"),
        {"parent_id": str(parent_id)},
    ).scalar_one()
    if int(children_count) < 1:
        raise ProfileValidationError("Parent profile must have at least one child.")

    return {"status": "ok", "user_id": user_id, "parent_id": parent_id, "role": "parent"}


def patch_teacher_profile(db: Session, user: AuthUser, payload: TeacherProfilePatch) -> dict:
    user_id = _ensure_user(
        db,
        user,
        target_role="teacher",
        first_name=payload.first_name,
        last_name=payload.last_name,
    )

    existing_teacher = (
        db.execute(
            text("select * from teachers where user_id = :user_id"),
            {"user_id": str(user_id)},
        )
        .mappings()
        .first()
    )

    address_id = _upsert_address(
        db,
        address_id=existing_teacher["address_id"] if existing_teacher else None,
        payload=payload.address,
        required_for_create=existing_teacher is None,
    )

    values = {
        "phone": payload.phone if payload.phone is not None else existing_teacher["phone"] if existing_teacher else None,
        "cpf": payload.cpf if payload.cpf is not None else existing_teacher["cpf"] if existing_teacher else None,
        "professional_number": payload.professional_number
        if payload.professional_number is not None
        else existing_teacher["professional_number"]
        if existing_teacher
        else None,
        "modality": payload.modality if payload.modality is not None else existing_teacher["modality"] if existing_teacher else None,
        "biography": payload.biography
        if payload.biography is not None
        else existing_teacher["biography"]
        if existing_teacher
        else None,
        "hourly_rate_cents": payload.hourly_rate_cents
        if payload.hourly_rate_cents is not None
        else existing_teacher["hourly_rate_cents"]
        if existing_teacher
        else None,
        "lesson_duration_minutes": payload.lesson_duration_minutes
        if payload.lesson_duration_minutes is not None
        else existing_teacher["lesson_duration_minutes"]
        if existing_teacher
        else None,
        "profile_photo_file_name": payload.profile_photo_file_name
        if payload.profile_photo_file_name is not None
        else existing_teacher["profile_photo_file_name"]
        if existing_teacher
        else None,
        "hide_experience": payload.hide_experience
        if payload.hide_experience is not None
        else existing_teacher["hide_experience"]
        if existing_teacher
        else False,
    }

    if values["cpf"] is None and existing_teacher is None:
        raise ProfileValidationError("Teacher profile is missing required field: cpf.")

    if existing_teacher:
        db.execute(
            text(
                """
                update teachers
                set
                  phone = :phone,
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
            {"teacher_id": str(existing_teacher["id"]), "address_id": str(address_id), **values},
        )
        teacher_id = UUID(str(existing_teacher["id"]))
    else:
        teacher_id = uuid4()
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
            {"id": str(teacher_id), "user_id": str(user_id), "address_id": str(address_id), **values},
        )

    if payload.skills_ops:
        for skill in payload.skills_ops.add:
            db.execute(
                text(
                    """
                    insert into teacher_skills (id, teacher_id, skill)
                    values (:id, :teacher_id, :skill)
                    on conflict (teacher_id, skill) do nothing
                    """
                ),
                {"id": str(uuid4()), "teacher_id": str(teacher_id), "skill": skill},
            )
        if payload.skills_ops.remove:
            delete_skills_stmt = text(
                """
                delete from teacher_skills
                where teacher_id = :teacher_id and skill in :skills
                """
            ).bindparams(bindparam("skills", expanding=True))
            db.execute(delete_skills_stmt, {"teacher_id": str(teacher_id), "skills": payload.skills_ops.remove})

    if payload.academic_records_ops:
        if payload.academic_records_ops.delete_ids:
            delete_academic_stmt = text(
                """
                delete from teacher_academic_records
                where teacher_id = :teacher_id and id in :ids
                """
            ).bindparams(bindparam("ids", expanding=True))
            db.execute(
                delete_academic_stmt,
                {"teacher_id": str(teacher_id), "ids": [str(item_id) for item_id in payload.academic_records_ops.delete_ids]},
            )

        for academic_record in payload.academic_records_ops.upsert:
            record_id = academic_record.id or uuid4()
            exists = db.execute(
                text(
                    """
                    select exists(select 1 from teacher_academic_records where id = :id and teacher_id = :teacher_id)
                    """
                ),
                {"id": str(record_id), "teacher_id": str(teacher_id)},
            ).scalar_one()
            params = {
                "id": str(record_id),
                "teacher_id": str(teacher_id),
                "degree_type": academic_record.degree_type,
                "course_name": academic_record.course_name,
                "institution": academic_record.institution,
                "completion_year": academic_record.completion_year,
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
        if payload.experiences_ops.delete_ids:
            delete_experiences_stmt = text(
                """
                delete from teacher_experiences
                where teacher_id = :teacher_id and id in :ids
                """
            ).bindparams(bindparam("ids", expanding=True))
            db.execute(
                delete_experiences_stmt,
                {"teacher_id": str(teacher_id), "ids": [str(item_id) for item_id in payload.experiences_ops.delete_ids]},
            )

        for experience in payload.experiences_ops.upsert:
            experience_id = experience.id or uuid4()
            exists = db.execute(
                text("select exists(select 1 from teacher_experiences where id = :id and teacher_id = :teacher_id)"),
                {"id": str(experience_id), "teacher_id": str(teacher_id)},
            ).scalar_one()
            params = {
                "id": str(experience_id),
                "profile_id": str(user_id),
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
                            id, profile_id, teacher_id, institution, role, responsibilities, description,
                            period_from, period_to, current_position
                          )
                        values
                          (
                            :id, :profile_id, :teacher_id, :institution, :role, :description, :description,
                            :period_from, :period_to, :current_position
                          )
                        """
                    ),
                    params,
                )

    if payload.availability_ops:
        if payload.availability_ops.delete_ids:
            delete_availability_stmt = text(
                """
                delete from teacher_availability
                where teacher_id = :teacher_id and id in :ids
                """
            ).bindparams(bindparam("ids", expanding=True))
            db.execute(
                delete_availability_stmt,
                {"teacher_id": str(teacher_id), "ids": [str(item_id) for item_id in payload.availability_ops.delete_ids]},
            )

        for slot in payload.availability_ops.upsert:
            slot_id = slot.id or uuid4()
            exists = db.execute(
                text("select exists(select 1 from teacher_availability where id = :id and teacher_id = :teacher_id)"),
                {"id": str(slot_id), "teacher_id": str(teacher_id)},
            ).scalar_one()
            params = {
                "id": str(slot_id),
                "profile_id": str(user_id),
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
                          (id, profile_id, teacher_id, day_of_week, start_time, end_time)
                        values
                          (:id, :profile_id, :teacher_id, :day_of_week, :start_time, :end_time)
                        """
                    ),
                    params,
                )

    availability_count = db.execute(
        text("select count(*) from teacher_availability where teacher_id = :teacher_id"),
        {"teacher_id": str(teacher_id)},
    ).scalar_one()
    if int(availability_count) < 1:
        raise ProfileValidationError("Teacher profile must have at least one availability slot.")

    return {"status": "ok", "user_id": user_id, "teacher_id": teacher_id, "role": "teacher"}


def set_teacher_activation(db: Session, teacher_id: UUID, is_active: bool) -> dict:
    result = (
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
    if not result:
        raise ProfileNotFoundError("Teacher profile not found.")

    return {
        "status": "ok",
        "teacher_id": UUID(str(result["id"])),
        "is_active": bool(result["is_active"]),
    }
