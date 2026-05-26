from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session


class IdentityNotFoundError(Exception):
    pass


class IdentityPermissionError(Exception):
    pass


def _uuid(value: object) -> UUID:
    return UUID(str(value))


def get_user_role(db: Session, user_id: str) -> str | None:
    return db.execute(
        text("select role from users where id = :user_id"),
        {"user_id": user_id},
    ).scalar()


def require_user_role(db: Session, user_id: str, expected_role: str) -> None:
    role = get_user_role(db, user_id)
    if role != expected_role:
        raise IdentityPermissionError(f"{expected_role.title()} permission required.")


def resolve_parent_id(db: Session, user_id: str) -> UUID:
    parent_id = db.execute(
        text("select id from parents where user_id = :user_id"),
        {"user_id": user_id},
    ).scalar()
    if not parent_id:
        raise IdentityNotFoundError("Parent profile does not exist yet.")
    return _uuid(parent_id)


def resolve_teacher_id(db: Session, user_id: str) -> UUID:
    teacher_id = db.execute(
        text("select id from teachers where user_id = :user_id"),
        {"user_id": user_id},
    ).scalar()
    if not teacher_id:
        raise IdentityNotFoundError("Teacher profile does not exist yet.")
    return _uuid(teacher_id)


def resolve_user_id_for_parent(db: Session, parent_id: UUID) -> UUID:
    user_id = db.execute(
        text("select user_id from parents where id = :parent_id"),
        {"parent_id": str(parent_id)},
    ).scalar()
    if not user_id:
        raise IdentityNotFoundError("Parent profile does not exist.")
    return _uuid(user_id)


def resolve_user_id_for_teacher(db: Session, teacher_id: UUID) -> UUID:
    user_id = db.execute(
        text("select user_id from teachers where id = :teacher_id"),
        {"teacher_id": str(teacher_id)},
    ).scalar()
    if not user_id:
        raise IdentityNotFoundError("Teacher profile does not exist.")
    return _uuid(user_id)


def get_actor_participant_ids(db: Session, user_id: str) -> tuple[UUID | None, UUID | None]:
    row = (
        db.execute(
            text(
                """
                select
                  p.id as parent_id,
                  t.id as teacher_id
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
        raise IdentityNotFoundError("User profile does not exist yet.")
    return (
        _uuid(row["parent_id"]) if row.get("parent_id") else None,
        _uuid(row["teacher_id"]) if row.get("teacher_id") else None,
    )
