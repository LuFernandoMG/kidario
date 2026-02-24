from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.security import AuthUser
from app.schemas.chat import ChatMessageCreateRequest


class ChatValidationError(Exception):
    pass


class ChatNotFoundError(Exception):
    pass


class ChatPermissionError(Exception):
    pass


def _full_name(first_name: str | None, last_name: str | None) -> str:
    normalized = " ".join(part for part in [first_name or "", last_name or ""] if part.strip()).strip()
    return normalized or "Usuário"


def _get_booking_with_participants(db: Session, booking_id: UUID) -> dict:
    row = (
        db.execute(
            text(
                """
                select
                  b.id,
                  b.parent_profile_id,
                  b.teacher_profile_id,
                  b.child_id,
                  b.status as booking_status,
                  pc.name as child_name,
                  pp_parent.first_name as parent_first_name,
                  pp_parent.last_name as parent_last_name,
                  pp_teacher.first_name as teacher_first_name,
                  pp_teacher.last_name as teacher_last_name
                from bookings b
                join parent_children pc on pc.id = b.child_id
                join profiles pp_parent on pp_parent.id = b.parent_profile_id
                join profiles pp_teacher on pp_teacher.id = b.teacher_profile_id
                where b.id = :booking_id
                """
            ),
            {"booking_id": str(booking_id)},
        )
        .mappings()
        .first()
    )
    if not row:
        raise ChatNotFoundError("Booking not found.")
    return dict(row)


def _map_thread_row(row: dict) -> dict:
    return {
        "id": row["id"],
        "booking_id": row["booking_id"],
        "parent_profile_id": row["parent_profile_id"],
        "teacher_profile_id": row["teacher_profile_id"],
        "child_id": row["child_id"],
        "booking_status": row["booking_status"],
        "parent_name": _full_name(row.get("parent_first_name"), row.get("parent_last_name")),
        "teacher_name": _full_name(row.get("teacher_first_name"), row.get("teacher_last_name")),
        "child_name": row.get("child_name") or "Criança",
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
        "last_message_at": row.get("last_message_at"),
    }


def _map_message_row(row: dict) -> dict:
    return {
        "id": row["id"],
        "thread_id": row["thread_id"],
        "sender_profile_id": row["sender_profile_id"],
        "body": row["body"],
        "created_at": row["created_at"],
    }


def _get_thread_with_participants(db: Session, thread_id: UUID) -> dict:
    row = (
        db.execute(
            text(
                """
                select
                  t.id,
                  t.booking_id,
                  t.parent_profile_id,
                  t.teacher_profile_id,
                  t.child_id,
                  b.status as booking_status,
                  t.created_at,
                  t.updated_at,
                  t.last_message_at,
                  pc.name as child_name,
                  pp_parent.first_name as parent_first_name,
                  pp_parent.last_name as parent_last_name,
                  pp_teacher.first_name as teacher_first_name,
                  pp_teacher.last_name as teacher_last_name
                from chat_threads t
                join parent_children pc on pc.id = t.child_id
                join bookings b on b.id = t.booking_id
                join profiles pp_parent on pp_parent.id = t.parent_profile_id
                join profiles pp_teacher on pp_teacher.id = t.teacher_profile_id
                where t.id = :thread_id
                """
            ),
            {"thread_id": str(thread_id)},
        )
        .mappings()
        .first()
    )
    if not row:
        raise ChatNotFoundError("Chat thread not found.")
    return dict(row)


def _ensure_actor_is_participant(actor_profile_id: str, parent_profile_id: str, teacher_profile_id: str) -> None:
    if actor_profile_id != parent_profile_id and actor_profile_id != teacher_profile_id:
        raise ChatPermissionError("You do not have access to this chat.")


def get_or_create_thread_from_booking(db: Session, user: AuthUser, booking_id: UUID) -> dict:
    booking = _get_booking_with_participants(db, booking_id)
    _ensure_actor_is_participant(
        user.user_id,
        str(booking["parent_profile_id"]),
        str(booking["teacher_profile_id"]),
    )

    thread_row = (
        db.execute(
            text(
                """
                insert into chat_threads
                  (booking_id, parent_profile_id, teacher_profile_id, child_id)
                values
                  (:booking_id, :parent_profile_id, :teacher_profile_id, :child_id)
                on conflict (booking_id)
                do update set booking_id = excluded.booking_id
                returning id
                """
            ),
            {
                "booking_id": str(booking_id),
                "parent_profile_id": str(booking["parent_profile_id"]),
                "teacher_profile_id": str(booking["teacher_profile_id"]),
                "child_id": str(booking["child_id"]),
            },
        )
        .mappings()
        .first()
    )
    if not thread_row:
        raise ChatValidationError("Could not create chat thread.")

    thread = _get_thread_with_participants(db, UUID(str(thread_row["id"])))
    return {
        "status": "ok",
        "thread": _map_thread_row(thread),
    }


def get_thread(db: Session, user: AuthUser, thread_id: UUID) -> dict:
    thread = _get_thread_with_participants(db, thread_id)
    _ensure_actor_is_participant(
        user.user_id,
        str(thread["parent_profile_id"]),
        str(thread["teacher_profile_id"]),
    )
    return {"thread": _map_thread_row(thread)}


def get_thread_messages(db: Session, user: AuthUser, thread_id: UUID, limit: int) -> dict:
    if limit < 1 or limit > 200:
        raise ChatValidationError("limit must be between 1 and 200.")

    thread = _get_thread_with_participants(db, thread_id)
    _ensure_actor_is_participant(
        user.user_id,
        str(thread["parent_profile_id"]),
        str(thread["teacher_profile_id"]),
    )

    rows = (
        db.execute(
            text(
                """
                select id, thread_id, sender_profile_id, body, created_at
                from chat_messages
                where thread_id = :thread_id
                order by created_at desc
                limit :limit
                """
            ),
            {"thread_id": str(thread_id), "limit": limit},
        )
        .mappings()
        .all()
    )

    ordered_rows = list(reversed(rows))
    return {"messages": [_map_message_row(dict(row)) for row in ordered_rows]}


def post_thread_message(db: Session, user: AuthUser, thread_id: UUID, payload: ChatMessageCreateRequest) -> dict:
    thread = _get_thread_with_participants(db, thread_id)
    _ensure_actor_is_participant(
        user.user_id,
        str(thread["parent_profile_id"]),
        str(thread["teacher_profile_id"]),
    )

    if thread["booking_status"] in ("cancelada", "concluida"):
        raise ChatValidationError("Este chat está em modo somente leitura para esta aula.")

    normalized_body = payload.body.strip()
    if not normalized_body:
        raise ChatValidationError("Message body cannot be empty.")

    row = (
        db.execute(
            text(
                """
                insert into chat_messages
                  (thread_id, sender_profile_id, body)
                values
                  (:thread_id, :sender_profile_id, :body)
                returning id, thread_id, sender_profile_id, body, created_at
                """
            ),
            {
                "thread_id": str(thread_id),
                "sender_profile_id": user.user_id,
                "body": normalized_body,
            },
        )
        .mappings()
        .first()
    )
    if not row:
        raise ChatValidationError("Could not send message.")

    return {
        "status": "ok",
        "message": _map_message_row(dict(row)),
    }
