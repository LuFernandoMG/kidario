from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.security import AuthUser
from app.schemas.v2_chat import ChatMessageCreateRequest
from app.services.identity_service import IdentityNotFoundError, get_actor_participant_ids


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
                  b.parent_id,
                  b.teacher_id,
                  p.user_id as parent_user_id,
                  t.user_id as teacher_user_id,
                  b.child_id,
                  b.status as booking_status,
                  c.name as child_name,
                  u_parent.first_name as parent_first_name,
                  u_parent.last_name as parent_last_name,
                  u_teacher.first_name as teacher_first_name,
                  u_teacher.last_name as teacher_last_name
                from bookings b
                join parents p on p.id = b.parent_id
                join teachers t on t.id = b.teacher_id
                join children c on c.id = b.child_id
                join users u_parent on u_parent.id = p.user_id
                join users u_teacher on u_teacher.id = t.user_id
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
    is_read_only = row["booking_status"] == "cancelada" and not bool(row.get("has_active_booking"))
    return {
        "id": row["id"],
        "booking_id": row["booking_id"],
        "parent_id": row["parent_id"],
        "teacher_id": row["teacher_id"],
        "child_id": row["child_id"],
        "status": row.get("status") or "active",
        "booking_status": row["booking_status"],
        "is_read_only": is_read_only,
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
        "sender_user_id": row["sender_user_id"],
        "body": row["body"],
        "created_at": row["created_at"],
    }


def _thread_select_sql(where_clause: str) -> str:
    return f"""
        select
          t.id,
          t.booking_id,
          t.parent_id,
          t.teacher_id,
          t.child_id,
          t.status,
          b.status as booking_status,
          exists (
            select 1
            from bookings b_active
            where b_active.parent_id = t.parent_id
              and b_active.teacher_id = t.teacher_id
              and b_active.child_id = t.child_id
              and b_active.status in ('pendente', 'confirmada')
          ) as has_active_booking,
          t.created_at,
          t.updated_at,
          t.last_message_at,
          c.name as child_name,
          u_parent.first_name as parent_first_name,
          u_parent.last_name as parent_last_name,
          u_teacher.first_name as teacher_first_name,
          u_teacher.last_name as teacher_last_name
        from chat_threads t
        join bookings b on b.id = t.booking_id
        join children c on c.id = t.child_id
        join parents p on p.id = t.parent_id
        join teachers teacher on teacher.id = t.teacher_id
        join users u_parent on u_parent.id = p.user_id
        join users u_teacher on u_teacher.id = teacher.user_id
        where {where_clause}
    """


def _get_thread_with_participants(db: Session, thread_id: UUID) -> dict:
    row = (
        db.execute(
            text(_thread_select_sql("t.id = :thread_id")),
            {"thread_id": str(thread_id)},
        )
        .mappings()
        .first()
    )
    if not row:
        raise ChatNotFoundError("Chat thread not found.")
    return dict(row)


def _ensure_actor_is_participant(db: Session, actor_user_id: str, parent_id: UUID | str, teacher_id: UUID | str) -> None:
    try:
        actor_parent_id, actor_teacher_id = get_actor_participant_ids(db, actor_user_id)
    except IdentityNotFoundError as exc:
        raise ChatPermissionError("You do not have access to this chat.") from exc
    if str(parent_id) != str(actor_parent_id) and str(teacher_id) != str(actor_teacher_id):
        raise ChatPermissionError("You do not have access to this chat.")


def get_or_create_thread_from_booking(db: Session, user: AuthUser, booking_id: UUID) -> dict:
    booking = _get_booking_with_participants(db, booking_id)
    _ensure_actor_is_participant(db, user.user_id, booking["parent_id"], booking["teacher_id"])

    thread_row = (
        db.execute(
            text("select id from chat_threads where booking_id = :booking_id limit 1"),
            {"booking_id": str(booking_id)},
        )
        .mappings()
        .first()
    )
    if not thread_row:
        existing_trio_thread = (
            db.execute(
                text(
                    """
                    select id
                    from chat_threads
                    where parent_id = :parent_id
                      and teacher_id = :teacher_id
                      and child_id = :child_id
                    order by coalesce(last_message_at, updated_at) desc, created_at asc
                    limit 1
                    """
                ),
                {
                    "parent_id": str(booking["parent_id"]),
                    "teacher_id": str(booking["teacher_id"]),
                    "child_id": str(booking["child_id"]),
                },
            )
            .mappings()
            .first()
        )
        if existing_trio_thread:
            thread_row = (
                db.execute(
                    text(
                        """
                        update chat_threads
                        set booking_id = :booking_id, updated_at = now()
                        where id = :thread_id
                        returning id
                        """
                    ),
                    {"booking_id": str(booking_id), "thread_id": str(existing_trio_thread["id"])},
                )
                .mappings()
                .first()
            )
        else:
            thread_row = (
                db.execute(
                    text(
                        """
                        insert into chat_threads
                          (
                            booking_id,
                            parent_id,
                            teacher_id,
                            child_id,
                            status
                          )
                        values
                          (
                            :booking_id,
                            :parent_id,
                            :teacher_id,
                            :child_id,
                            'active'
                          )
                        returning id
                        """
                    ),
                    {
                        "booking_id": str(booking_id),
                        "parent_id": str(booking["parent_id"]),
                        "teacher_id": str(booking["teacher_id"]),
                        "child_id": str(booking["child_id"]),
                    },
                )
                .mappings()
                .first()
            )
    if not thread_row:
        raise ChatValidationError("Could not create chat thread.")
    thread = _get_thread_with_participants(db, UUID(str(thread_row["id"])))
    return {"status": "ok", "thread": _map_thread_row(thread)}


def get_thread(db: Session, user: AuthUser, thread_id: UUID) -> dict:
    thread = _get_thread_with_participants(db, thread_id)
    _ensure_actor_is_participant(db, user.user_id, thread["parent_id"], thread["teacher_id"])
    return {"thread": _map_thread_row(thread)}


def list_threads(db: Session, user: AuthUser, limit: int, booking_status: str | None = None) -> dict:
    if limit < 1 or limit > 200:
        raise ChatValidationError("limit must be between 1 and 200.")

    actor_parent_id, actor_teacher_id = get_actor_participant_ids(db, user.user_id)
    where_clauses = ["(t.parent_id = :actor_parent_id or t.teacher_id = :actor_teacher_id)"]
    params: dict[str, object] = {
        "actor_parent_id": str(actor_parent_id) if actor_parent_id else None,
        "actor_teacher_id": str(actor_teacher_id) if actor_teacher_id else None,
        "limit": limit,
    }
    if booking_status:
        where_clauses.append("b.status = :booking_status")
        params["booking_status"] = booking_status

    rows = (
        db.execute(
            text(
                f"""
                select *
                from (
                  select distinct on (thread_base.parent_id, thread_base.teacher_id, thread_base.child_id)
                    thread_base.*
                  from (
                    {_thread_select_sql(' and '.join(where_clauses))}
                  ) thread_base
                  order by
                    thread_base.parent_id,
                    thread_base.teacher_id,
                    thread_base.child_id,
                    coalesce(thread_base.last_message_at, thread_base.updated_at) desc,
                    thread_base.created_at asc
                ) dedup_threads
                order by coalesce(dedup_threads.last_message_at, dedup_threads.updated_at) desc
                limit :limit
                """
            ),
            params,
        )
        .mappings()
        .all()
    )
    return {"threads": [_map_thread_row(dict(row)) for row in rows]}


def get_thread_messages(db: Session, user: AuthUser, thread_id: UUID, limit: int) -> dict:
    if limit < 1 or limit > 200:
        raise ChatValidationError("limit must be between 1 and 200.")

    thread = _get_thread_with_participants(db, thread_id)
    _ensure_actor_is_participant(db, user.user_id, thread["parent_id"], thread["teacher_id"])

    rows = (
        db.execute(
            text(
                """
                select id, thread_id, sender_user_id, body, created_at
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
    return {"messages": [_map_message_row(dict(row)) for row in reversed(rows)]}


def post_thread_message(db: Session, user: AuthUser, thread_id: UUID, payload: ChatMessageCreateRequest) -> dict:
    thread = _get_thread_with_participants(db, thread_id)
    _ensure_actor_is_participant(db, user.user_id, thread["parent_id"], thread["teacher_id"])
    if thread["booking_status"] == "cancelada" and not bool(thread.get("has_active_booking")):
        raise ChatValidationError("Este chat está em modo somente leitura para esta aula cancelada.")

    normalized_body = payload.body.strip()
    if not normalized_body:
        raise ChatValidationError("Message body cannot be empty.")

    row = (
        db.execute(
            text(
                """
                insert into chat_messages
                  (thread_id, sender_user_id, body)
                values
                  (:thread_id, :sender_user_id, :body)
                returning id, thread_id, sender_user_id, body, created_at
                """
            ),
            {
                "thread_id": str(thread_id),
                "sender_user_id": user.user_id,
                "body": normalized_body,
            },
        )
        .mappings()
        .first()
    )
    if not row:
        raise ChatValidationError("Could not send message.")
    return {"status": "ok", "message": _map_message_row(dict(row))}
