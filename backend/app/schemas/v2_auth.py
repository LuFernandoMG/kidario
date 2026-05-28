from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.v2_profiles import ChildCreateRequest, ParentProfileUpdateRequest, TeacherProfileUpdateRequest


SignupRole = Literal["parent", "teacher"]


class ParentSignupProfile(ParentProfileUpdateRequest):
    children: list[ChildCreateRequest] = Field(default_factory=list)


class AuthSignupRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: str
    password: str = Field(min_length=8, max_length=128)
    full_name: str | None = None
    role: SignupRole
    parent: ParentSignupProfile | None = None
    teacher: TeacherProfileUpdateRequest | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    captcha_token: str | None = None
    honeypot: str | None = None

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        normalized = value.strip()
        if "@" not in normalized or "." not in normalized.split("@", maxsplit=1)[-1]:
            raise ValueError("email must be a valid address.")
        return normalized.lower()

    @model_validator(mode="after")
    def validate_role_payloads(self) -> "AuthSignupRequest":
        if self.role == "parent":
            if self.parent is None:
                raise ValueError("parent is required when role is 'parent'.")
            if self.teacher is not None:
                raise ValueError("teacher must be null when role is 'parent'.")
            if not self.parent.children:
                raise ValueError("parent.children must include at least one child.")
        else:
            if self.teacher is None:
                raise ValueError("teacher is required when role is 'teacher'.")
            if self.parent is not None:
                raise ValueError("parent must be null when role is 'teacher'.")
        return self


class AuthSignupResponse(BaseModel):
    status: str = "ok"
    user_id: UUID
    parent_id: UUID | None = None
    teacher_id: UUID | None = None
    role: SignupRole
    email_confirmation_required: bool
    access_token: str | None = None
    refresh_token: str | None = None
    expires_in: int | None = None
    token_type: str | None = None
