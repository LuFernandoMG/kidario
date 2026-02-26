from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Security, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.security import AuthUser
from app.db.session import get_db
from app.schemas.chat import (
    ChatMessageCreateRequest,
    ChatMessageCreateResponse,
    ChatMessagesResponse,
    ChatThreadGetOrCreateResponse,
    ChatThreadsResponse,
    ChatThreadResponse,
)
from app.services.chat_service import (
    ChatNotFoundError,
    ChatPermissionError,
    ChatValidationError,
    get_or_create_thread_from_booking,
    list_threads,
    get_thread,
    get_thread_messages,
    post_thread_message,
)

router = APIRouter(tags=["chat"])


def _raise_http_from_sql_error(exc: SQLAlchemyError) -> None:
    sqlstate = getattr(getattr(exc, "orig", None), "sqlstate", None)
    if sqlstate == "42P01":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database schema not initialized. Run SQL migrations in backend/sql.",
        ) from exc

    settings = get_settings()
    detail = "Database error."
    if settings.env != "production":
        detail = f"{detail} Reason: {exc}"
    raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=detail) from exc


@router.post(
    "/chat/threads/from-booking/{booking_id}",
    response_model=ChatThreadGetOrCreateResponse,
    status_code=status.HTTP_201_CREATED,
)
def post_chat_thread_from_booking(
    booking_id: UUID,
    user: AuthUser = Security(get_current_user),
    db: Session = Depends(get_db),
) -> ChatThreadGetOrCreateResponse:
    try:
        with db.begin():
            data = get_or_create_thread_from_booking(db, user, booking_id)
    except ChatNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ChatPermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except ChatValidationError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except SQLAlchemyError as exc:
        _raise_http_from_sql_error(exc)
    return ChatThreadGetOrCreateResponse(**data)


@router.get("/chat/threads/{thread_id}", response_model=ChatThreadResponse)
def get_chat_thread(
    thread_id: UUID,
    user: AuthUser = Security(get_current_user),
    db: Session = Depends(get_db),
) -> ChatThreadResponse:
    try:
        data = get_thread(db, user, thread_id)
    except ChatNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ChatPermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except ChatValidationError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except SQLAlchemyError as exc:
        _raise_http_from_sql_error(exc)
    return ChatThreadResponse(**data)


@router.get("/chat/threads", response_model=ChatThreadsResponse)
def get_chat_threads(
    limit: int = Query(default=30, ge=1, le=200),
    booking_status: str | None = Query(default=None, alias="status"),
    user: AuthUser = Security(get_current_user),
    db: Session = Depends(get_db),
) -> ChatThreadsResponse:
    try:
        data = list_threads(db, user, limit=limit, booking_status=booking_status)
    except ChatPermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except ChatValidationError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except SQLAlchemyError as exc:
        _raise_http_from_sql_error(exc)
    return ChatThreadsResponse(**data)


@router.get("/chat/threads/{thread_id}/messages", response_model=ChatMessagesResponse)
def get_chat_messages(
    thread_id: UUID,
    limit: int = Query(default=60, ge=1, le=200),
    user: AuthUser = Security(get_current_user),
    db: Session = Depends(get_db),
) -> ChatMessagesResponse:
    try:
        data = get_thread_messages(db, user, thread_id, limit)
    except ChatNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ChatPermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except ChatValidationError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except SQLAlchemyError as exc:
        _raise_http_from_sql_error(exc)
    return ChatMessagesResponse(**data)


@router.post(
    "/chat/threads/{thread_id}/messages",
    response_model=ChatMessageCreateResponse,
    status_code=status.HTTP_201_CREATED,
)
def post_chat_message(
    thread_id: UUID,
    payload: ChatMessageCreateRequest,
    user: AuthUser = Security(get_current_user),
    db: Session = Depends(get_db),
) -> ChatMessageCreateResponse:
    try:
        with db.begin():
            data = post_thread_message(db, user, thread_id, payload)
    except ChatNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ChatPermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except ChatValidationError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except SQLAlchemyError as exc:
        _raise_http_from_sql_error(exc)
    return ChatMessageCreateResponse(**data)
