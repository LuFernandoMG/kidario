from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.profiles import ParentProfilePatch, TeacherProfilePatch


SignupRole = Literal["parent", "teacher"]


class AuthSignupRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: str
    password: str = Field(min_length=8, max_length=128)
    full_name: str | None = None
    role: SignupRole
    parent_profile: ParentProfilePatch | None = None
    teacher_profile: TeacherProfilePatch | None = None
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
            if self.parent_profile is None:
                raise ValueError("parent_profile is required when role is 'parent'.")
            if self.teacher_profile is not None:
                raise ValueError("teacher_profile must be null when role is 'parent'.")
        else:
            if self.teacher_profile is None:
                raise ValueError("teacher_profile is required when role is 'teacher'.")
            if self.parent_profile is not None:
                raise ValueError("parent_profile must be null when role is 'teacher'.")
        return self


class AuthSignupResponse(BaseModel):
    status: str = "ok"
    profile_id: UUID
    auth_user_id: UUID
    role: SignupRole
    email_confirmation_required: bool
    access_token: str | None = None
    refresh_token: str | None = None
    expires_in: int | None = None
    token_type: str | None = None
