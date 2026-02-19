from uuid import UUID, uuid4

from sqlalchemy import bindparam, text
from sqlalchemy.orm import Session

from app.core.security import AuthUser
from app.schemas.profiles import (
    ParentProfilePatch,
    TeacherProfilePatch,
)


class ProfileConflictError(Exception):
    pass


class ProfileValidationError(Exception):
    pass


class ProfileNotFoundError(Exception):
    pass


def _get_profile_row(db: Session, profile_id: str):
    return (
        db.execute(
            text(
                """
                select id, email, first_name, last_name, role
                from profiles
                where id = :profile_id
                """
            ),
            {"profile_id": profile_id},
        )
        .mappings()
        .first()
    )


def _ensure_profile(
    db: Session,
    user: AuthUser,
    target_role: str,
    first_name: str | None,
    last_name: str | None,
) -> UUID:
    row = _get_profile_row(db, user.user_id)

    if row is None:
        if not user.email:
            raise ProfileValidationError("Token does not include email.")
        profile_id = UUID(user.user_id)
        db.execute(
            text(
                """
                insert into profiles (id, email, first_name, last_name, role, auth_email_confirmed)
                values (:id, :email, :first_name, :last_name, :role, true)
                """
            ),
            {
                "id": str(profile_id),
                "email": user.email,
                "first_name": first_name,
                "last_name": last_name,
                "role": target_role,
            },
        )
        return profile_id

    if row["role"] != target_role:
        raise ProfileConflictError(f"User already registered as role '{row['role']}'.")

    db.execute(
        text(
            """
            update profiles
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


def get_me(db: Session, user: AuthUser) -> dict:
    profile = _get_profile_row(db, user.user_id)
    if not profile:
        raise ProfileNotFoundError("Profile does not exist yet.")

    parent_exists = db.execute(
        text("select exists(select 1 from parent_profiles where profile_id = :profile_id)"),
        {"profile_id": user.user_id},
    ).scalar_one()
    teacher_exists = db.execute(
        text("select exists(select 1 from teacher_profiles where profile_id = :profile_id)"),
        {"profile_id": user.user_id},
    ).scalar_one()

    return {
        "profile": profile,
        "parent_profile_exists": bool(parent_exists),
        "teacher_profile_exists": bool(teacher_exists),
    }


def patch_parent_profile(db: Session, user: AuthUser, payload: ParentProfilePatch) -> dict:
    profile_id = _ensure_profile(
        db,
        user,
        target_role="parent",
        first_name=payload.first_name,
        last_name=payload.last_name,
    )

    existing_parent = (
        db.execute(
            text("select * from parent_profiles where profile_id = :profile_id"),
            {"profile_id": str(profile_id)},
        )
        .mappings()
        .first()
    )

    phone = payload.phone if payload.phone is not None else existing_parent["phone"] if existing_parent else None
    birth_date = (
        payload.birth_date if payload.birth_date is not None else existing_parent["birth_date"] if existing_parent else None
    )
    address = payload.address if payload.address is not None else existing_parent["address"] if existing_parent else None
    bio = payload.bio if payload.bio is not None else existing_parent["bio"] if existing_parent else None

    if existing_parent:
        db.execute(
            text(
                """
                update parent_profiles
                set phone = :phone, birth_date = :birth_date, address = :address, bio = :bio, updated_at = now()
                where profile_id = :profile_id
                """
            ),
            {
                "profile_id": str(profile_id),
                "phone": phone,
                "birth_date": birth_date,
                "address": address,
                "bio": bio,
            },
        )
    else:
        db.execute(
            text(
                """
                insert into parent_profiles (profile_id, phone, birth_date, address, bio)
                values (:profile_id, :phone, :birth_date, :address, :bio)
                """
            ),
            {
                "profile_id": str(profile_id),
                "phone": phone,
                "birth_date": birth_date,
                "address": address,
                "bio": bio,
            },
        )

    if payload.children_ops:
        if payload.children_ops.delete_ids:
            delete_stmt = text(
                """
                delete from parent_children
                where profile_id = :profile_id and id in :ids
                """
            ).bindparams(bindparam("ids", expanding=True))
            db.execute(
                delete_stmt,
                {
                    "profile_id": str(profile_id),
                    "ids": [str(child_id) for child_id in payload.children_ops.delete_ids],
                },
            )

        for child in payload.children_ops.upsert:
            child_id = child.id or uuid4()
            exists = db.execute(
                text(
                    """
                    select exists(
                      select 1 from parent_children where id = :id and profile_id = :profile_id
                    )
                    """
                ),
                {"id": str(child_id), "profile_id": str(profile_id)},
            ).scalar_one()
            if exists:
                db.execute(
                    text(
                        """
                        update parent_children
                        set
                          name = :name,
                          gender = :gender,
                          age = :age,
                          current_grade = :current_grade,
                          birth_month_year = :birth_month_year,
                          school = :school,
                          focus_points = :focus_points,
                          updated_at = now()
                        where id = :id and profile_id = :profile_id
                        """
                    ),
                    {
                        "id": str(child_id),
                        "profile_id": str(profile_id),
                        "name": child.name,
                        "gender": child.gender,
                        "age": child.age,
                        "current_grade": child.current_grade,
                        "birth_month_year": child.birth_month_year,
                        "school": child.school,
                        "focus_points": child.focus_points,
                    },
                )
            else:
                db.execute(
                    text(
                        """
                        insert into parent_children
                          (id, profile_id, name, gender, age, current_grade, birth_month_year, school, focus_points)
                        values
                          (:id, :profile_id, :name, :gender, :age, :current_grade, :birth_month_year, :school, :focus_points)
                        """
                    ),
                    {
                        "id": str(child_id),
                        "profile_id": str(profile_id),
                        "name": child.name,
                        "gender": child.gender,
                        "age": child.age,
                        "current_grade": child.current_grade,
                        "birth_month_year": child.birth_month_year,
                        "school": child.school,
                        "focus_points": child.focus_points,
                    },
                )

    children_count = db.execute(
        text("select count(*) from parent_children where profile_id = :profile_id"),
        {"profile_id": str(profile_id)},
    ).scalar_one()
    if int(children_count) < 1:
        raise ProfileValidationError("Parent profile must have at least one child.")

    return {"status": "ok", "profile_id": profile_id, "role": "parent"}


def patch_teacher_profile(db: Session, user: AuthUser, payload: TeacherProfilePatch) -> dict:
    profile_id = _ensure_profile(
        db,
        user,
        target_role="teacher",
        first_name=payload.first_name,
        last_name=payload.last_name,
    )

    existing_teacher = (
        db.execute(
            text("select * from teacher_profiles where profile_id = :profile_id"),
            {"profile_id": str(profile_id)},
        )
        .mappings()
        .first()
    )

    values = {
        "phone": payload.phone if payload.phone is not None else existing_teacher["phone"] if existing_teacher else None,
        "cpf": payload.cpf if payload.cpf is not None else existing_teacher["cpf"] if existing_teacher else None,
        "professional_registration": payload.professional_registration
        if payload.professional_registration is not None
        else existing_teacher["professional_registration"]
        if existing_teacher
        else None,
        "city": payload.city if payload.city is not None else existing_teacher["city"] if existing_teacher else None,
        "state": payload.state if payload.state is not None else existing_teacher["state"] if existing_teacher else None,
        "modality": payload.modality if payload.modality is not None else existing_teacher["modality"] if existing_teacher else None,
        "mini_bio": payload.mini_bio if payload.mini_bio is not None else existing_teacher["mini_bio"] if existing_teacher else None,
        "hourly_rate": payload.hourly_rate
        if payload.hourly_rate is not None
        else existing_teacher["hourly_rate"]
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
        "request_experience_anonymity": payload.request_experience_anonymity
        if payload.request_experience_anonymity is not None
        else existing_teacher["request_experience_anonymity"]
        if existing_teacher
        else False,
    }

    if existing_teacher:
        db.execute(
            text(
                """
                update teacher_profiles
                set
                  phone = :phone,
                  cpf = :cpf,
                  professional_registration = :professional_registration,
                  city = :city,
                  state = :state,
                  modality = :modality,
                  mini_bio = :mini_bio,
                  hourly_rate = :hourly_rate,
                  lesson_duration_minutes = :lesson_duration_minutes,
                  profile_photo_file_name = :profile_photo_file_name,
                  request_experience_anonymity = :request_experience_anonymity,
                  updated_at = now()
                where profile_id = :profile_id
                """
            ),
            {"profile_id": str(profile_id), **values},
        )
    else:
        db.execute(
            text(
                """
                insert into teacher_profiles
                  (
                    profile_id, phone, cpf, professional_registration, city, state, modality, mini_bio,
                    hourly_rate, lesson_duration_minutes, profile_photo_file_name, request_experience_anonymity
                  )
                values
                  (
                    :profile_id, :phone, :cpf, :professional_registration, :city, :state, :modality, :mini_bio,
                    :hourly_rate, :lesson_duration_minutes, :profile_photo_file_name, :request_experience_anonymity
                  )
                """
            ),
            {"profile_id": str(profile_id), **values},
        )

    if payload.specialties_ops:
        for specialty in payload.specialties_ops.add:
            db.execute(
                text(
                    """
                    insert into teacher_specialties (id, profile_id, specialty)
                    values (:id, :profile_id, :specialty)
                    on conflict (profile_id, specialty) do nothing
                    """
                ),
                {"id": str(uuid4()), "profile_id": str(profile_id), "specialty": specialty},
            )
        if payload.specialties_ops.remove:
            delete_specialties_stmt = text(
                """
                delete from teacher_specialties
                where profile_id = :profile_id and specialty in :specialties
                """
            ).bindparams(bindparam("specialties", expanding=True))
            db.execute(
                delete_specialties_stmt,
                {"profile_id": str(profile_id), "specialties": payload.specialties_ops.remove},
            )

    if payload.formations_ops:
        if payload.formations_ops.delete_ids:
            delete_formations_stmt = text(
                """
                delete from teacher_formations
                where profile_id = :profile_id and id in :ids
                """
            ).bindparams(bindparam("ids", expanding=True))
            db.execute(
                delete_formations_stmt,
                {
                    "profile_id": str(profile_id),
                    "ids": [str(formation_id) for formation_id in payload.formations_ops.delete_ids],
                },
            )

        for formation in payload.formations_ops.upsert:
            formation_id = formation.id or uuid4()
            exists = db.execute(
                text(
                    """
                    select exists(
                      select 1 from teacher_formations where id = :id and profile_id = :profile_id
                    )
                    """
                ),
                {"id": str(formation_id), "profile_id": str(profile_id)},
            ).scalar_one()
            if exists:
                db.execute(
                    text(
                        """
                        update teacher_formations
                        set
                          degree_type = :degree_type,
                          course_name = :course_name,
                          institution = :institution,
                          completion_year = :completion_year
                        where id = :id and profile_id = :profile_id
                        """
                    ),
                    {
                        "id": str(formation_id),
                        "profile_id": str(profile_id),
                        "degree_type": formation.degree_type,
                        "course_name": formation.course_name,
                        "institution": formation.institution,
                        "completion_year": formation.completion_year,
                    },
                )
            else:
                db.execute(
                    text(
                        """
                        insert into teacher_formations
                          (id, profile_id, degree_type, course_name, institution, completion_year)
                        values
                          (:id, :profile_id, :degree_type, :course_name, :institution, :completion_year)
                        """
                    ),
                    {
                        "id": str(formation_id),
                        "profile_id": str(profile_id),
                        "degree_type": formation.degree_type,
                        "course_name": formation.course_name,
                        "institution": formation.institution,
                        "completion_year": formation.completion_year,
                    },
                )

    if payload.experiences_ops:
        if payload.experiences_ops.delete_ids:
            delete_experiences_stmt = text(
                """
                delete from teacher_experiences
                where profile_id = :profile_id and id in :ids
                """
            ).bindparams(bindparam("ids", expanding=True))
            db.execute(
                delete_experiences_stmt,
                {
                    "profile_id": str(profile_id),
                    "ids": [str(experience_id) for experience_id in payload.experiences_ops.delete_ids],
                },
            )

        for experience in payload.experiences_ops.upsert:
            experience_id = experience.id or uuid4()
            exists = db.execute(
                text(
                    """
                    select exists(
                      select 1 from teacher_experiences where id = :id and profile_id = :profile_id
                    )
                    """
                ),
                {"id": str(experience_id), "profile_id": str(profile_id)},
            ).scalar_one()
            if exists:
                db.execute(
                    text(
                        """
                        update teacher_experiences
                        set
                          institution = :institution,
                          role = :role,
                          responsibilities = :responsibilities,
                          period_from = :period_from,
                          period_to = :period_to,
                          current_position = :current_position
                        where id = :id and profile_id = :profile_id
                        """
                    ),
                    {
                        "id": str(experience_id),
                        "profile_id": str(profile_id),
                        "institution": experience.institution,
                        "role": experience.role,
                        "responsibilities": experience.responsibilities,
                        "period_from": experience.period_from,
                        "period_to": experience.period_to,
                        "current_position": experience.current_position,
                    },
                )
            else:
                db.execute(
                    text(
                        """
                        insert into teacher_experiences
                          (
                            id, profile_id, institution, role, responsibilities, period_from, period_to, current_position
                          )
                        values
                          (
                            :id, :profile_id, :institution, :role, :responsibilities, :period_from, :period_to, :current_position
                          )
                        """
                    ),
                    {
                        "id": str(experience_id),
                        "profile_id": str(profile_id),
                        "institution": experience.institution,
                        "role": experience.role,
                        "responsibilities": experience.responsibilities,
                        "period_from": experience.period_from,
                        "period_to": experience.period_to,
                        "current_position": experience.current_position,
                    },
                )

    if payload.availability_ops:
        if payload.availability_ops.delete_ids:
            delete_availability_stmt = text(
                """
                delete from teacher_availability
                where profile_id = :profile_id and id in :ids
                """
            ).bindparams(bindparam("ids", expanding=True))
            db.execute(
                delete_availability_stmt,
                {
                    "profile_id": str(profile_id),
                    "ids": [str(slot_id) for slot_id in payload.availability_ops.delete_ids],
                },
            )

        for slot in payload.availability_ops.upsert:
            slot_id = slot.id or uuid4()
            exists = db.execute(
                text(
                    """
                    select exists(
                      select 1 from teacher_availability where id = :id and profile_id = :profile_id
                    )
                    """
                ),
                {"id": str(slot_id), "profile_id": str(profile_id)},
            ).scalar_one()
            if exists:
                db.execute(
                    text(
                        """
                        update teacher_availability
                        set
                          day_of_week = :day_of_week,
                          start_time = :start_time,
                          end_time = :end_time
                        where id = :id and profile_id = :profile_id
                        """
                    ),
                    {
                        "id": str(slot_id),
                        "profile_id": str(profile_id),
                        "day_of_week": slot.day_of_week,
                        "start_time": slot.start_time,
                        "end_time": slot.end_time,
                    },
                )
            else:
                db.execute(
                    text(
                        """
                        insert into teacher_availability (id, profile_id, day_of_week, start_time, end_time)
                        values (:id, :profile_id, :day_of_week, :start_time, :end_time)
                        """
                    ),
                    {
                        "id": str(slot_id),
                        "profile_id": str(profile_id),
                        "day_of_week": slot.day_of_week,
                        "start_time": slot.start_time,
                        "end_time": slot.end_time,
                    },
                )

    availability_count = db.execute(
        text("select count(*) from teacher_availability where profile_id = :profile_id"),
        {"profile_id": str(profile_id)},
    ).scalar_one()
    if int(availability_count) < 1:
        raise ProfileValidationError("Teacher profile must have at least one availability slot.")

    return {"status": "ok", "profile_id": profile_id, "role": "teacher"}


def set_teacher_activation(db: Session, profile_id: UUID, is_active_teacher: bool) -> dict:
    result = (
        db.execute(
            text(
                """
                update teacher_profiles
                set is_active_teacher = :is_active_teacher, updated_at = now()
                where profile_id = :profile_id
                returning profile_id, is_active_teacher
                """
            ),
            {"profile_id": str(profile_id), "is_active_teacher": is_active_teacher},
        )
        .mappings()
        .first()
    )
    if not result:
        raise ProfileNotFoundError("Teacher profile not found.")

    return {
        "status": "ok",
        "profile_id": UUID(str(result["profile_id"])),
        "is_active_teacher": bool(result["is_active_teacher"]),
    }

