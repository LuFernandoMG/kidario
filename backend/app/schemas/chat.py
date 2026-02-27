from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


BookingStatus = Literal["pendente", "confirmada", "cancelada", "concluida"]


class ChatThreadView(BaseModel):
    id: UUID
    booking_id: UUID
    parent_profile_id: UUID
    teacher_profile_id: UUID
    child_id: UUID
    booking_status: BookingStatus
    is_read_only: bool
    parent_name: str
    teacher_name: str
    child_name: str
    created_at: datetime
    updated_at: datetime
    last_message_at: datetime | None = None


class ChatThreadGetOrCreateResponse(BaseModel):
    status: str = "ok"
    thread: ChatThreadView


class ChatThreadResponse(BaseModel):
    thread: ChatThreadView


class ChatThreadsResponse(BaseModel):
    threads: list[ChatThreadView]


class ChatMessageView(BaseModel):
    id: UUID
    thread_id: UUID
    sender_profile_id: UUID
    body: str
    created_at: datetime


class ChatMessagesResponse(BaseModel):
    messages: list[ChatMessageView]


class ChatMessageCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    body: str = Field(min_length=1, max_length=1000)

    @field_validator("body")
    @classmethod
    def validate_body(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Message body cannot be empty.")
        return normalized


class ChatMessageCreateResponse(BaseModel):
    status: str = "ok"
    message: ChatMessageView
