from datetime import date, datetime, time
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


UserRole = Literal["parent", "teacher", "admin"]
TeacherModality = Literal["online", "presencial", "ambos"]
ChildGender = Literal["girl", "boy", "other", "prefer not to disclose"]


class UserProfile(BaseModel):
    id: UUID
    email: str
    first_name: str
    last_name: str
    role: UserRole
    auth_email_confirmed: bool
    created_at: datetime
    updated_at: datetime


class AdminIdentity(BaseModel):
    is_admin: bool = True


class MeResponse(BaseModel):
    user: UserProfile
    parent_id: UUID | None = None
    teacher_id: UUID | None = None
    admin: AdminIdentity | None = None


class MeUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    first_name: str | None = None
    last_name: str | None = None

    @model_validator(mode="after")
    def ensure_not_empty(self) -> "MeUpdateRequest":
        if not self.model_fields_set:
            raise ValueError("Payload must include at least one field to patch.")
        return self


class Address(BaseModel):
    id: UUID
    street: str
    number: str | None = None
    complement: str | None = None
    district: str
    city: str
    state: str
    postal_code: str | None = None
    country: str = "BR"
    latitude: float | None = None
    longitude: float | None = None
    created_at: datetime
    updated_at: datetime


class AddressInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    street: str | None = None
    number: str | None = None
    complement: str | None = None
    district: str | None = None
    city: str | None = None
    state: str | None = None
    postal_code: str | None = None
    country: str | None = None
    latitude: float | None = None
    longitude: float | None = None


class Child(BaseModel):
    id: UUID
    parent_id: UUID
    name: str
    gender: ChildGender | None = None
    birth_month_year: date | None = None
    current_grade: str | None = None
    school: str | None = None
    focus_points: str | None = None
    created_at: datetime
    updated_at: datetime


class ChildCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1)
    gender: ChildGender | None = None
    birth_month_year: date | None = None
    current_grade: str | None = None
    school: str | None = None
    focus_points: str | None = None


class ChildUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1)
    gender: ChildGender | None = None
    birth_month_year: date | None = None
    current_grade: str | None = None
    school: str | None = None
    focus_points: str | None = None

    @model_validator(mode="after")
    def ensure_not_empty(self) -> "ChildUpdateRequest":
        if not self.model_fields_set:
            raise ValueError("Payload must include at least one field to patch.")
        return self


class ChildrenResponse(BaseModel):
    children: list[Child]


class DeleteChildResponse(BaseModel):
    status: str = "ok"
    child_id: UUID


class TeacherProfilePhotoUploadResponse(BaseModel):
    status: str = "ok"
    user_id: UUID
    role: UserRole
    teacher_id: UUID
    profile_photo_file_name: str


class ParentProfile(BaseModel):
    id: UUID
    user: UserProfile
    phone: str
    birth_date: date
    cpf_masked: str | None = None
    bio: str | None = None
    address: Address
    children: list[Child] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class ParentProfileUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    first_name: str | None = None
    last_name: str | None = None
    phone: str | None = None
    birth_date: date | None = None
    cpf: str | None = None
    bio: str | None = None
    address: AddressInput | None = None

    @model_validator(mode="after")
    def ensure_not_empty(self) -> "ParentProfileUpdateRequest":
        if not self.model_fields_set:
            raise ValueError("Payload must include at least one field to patch.")
        return self


class TeacherSkill(BaseModel):
    id: UUID
    teacher_id: UUID
    skill: str
    created_at: datetime
    updated_at: datetime


class TeacherAcademicRecord(BaseModel):
    id: UUID
    teacher_id: UUID
    degree_type: str
    course_name: str
    institution: str
    completion_year: str | None = None
    created_at: datetime
    updated_at: datetime


class TeacherExperience(BaseModel):
    id: UUID
    teacher_id: UUID
    institution: str
    role: str
    description: str
    period_from: str
    period_to: str | None = None
    current_position: bool
    created_at: datetime
    updated_at: datetime


class TeacherAvailabilityRule(BaseModel):
    id: UUID
    teacher_id: UUID
    day_of_week: int = Field(ge=0, le=6)
    start_time: time
    end_time: time
    created_at: datetime
    updated_at: datetime


class TeacherSkillsOps(BaseModel):
    model_config = ConfigDict(extra="forbid")

    add: list[str] = Field(default_factory=list)
    remove: list[str] = Field(default_factory=list)


class TeacherAcademicRecordUpsert(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID | None = None
    degree_type: str
    course_name: str
    institution: str
    completion_year: str | None = None


class TeacherAcademicRecordsOps(BaseModel):
    model_config = ConfigDict(extra="forbid")

    upsert: list[TeacherAcademicRecordUpsert] = Field(default_factory=list)
    delete_ids: list[UUID] = Field(default_factory=list)


class TeacherExperienceUpsert(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID | None = None
    institution: str
    role: str
    description: str
    period_from: str
    period_to: str | None = None
    current_position: bool = False


class TeacherExperiencesOps(BaseModel):
    model_config = ConfigDict(extra="forbid")

    upsert: list[TeacherExperienceUpsert] = Field(default_factory=list)
    delete_ids: list[UUID] = Field(default_factory=list)


class TeacherAvailabilityUpsert(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID | None = None
    day_of_week: int = Field(ge=0, le=6)
    start_time: time
    end_time: time


class TeacherAvailabilityOps(BaseModel):
    model_config = ConfigDict(extra="forbid")

    upsert: list[TeacherAvailabilityUpsert] = Field(default_factory=list)
    delete_ids: list[UUID] = Field(default_factory=list)


class TeacherProfile(BaseModel):
    id: UUID
    user: UserProfile
    phone: str | None = None
    cpf_masked: str | None = None
    professional_number: str | None = None
    modality: TeacherModality | None = None
    biography: str | None = None
    hourly_rate_cents: int | None = None
    lesson_duration_minutes: int | None = None
    profile_photo_file_name: str | None = None
    profile_photo_url: str | None = None
    hide_experience: bool
    is_active: bool
    address: Address
    skills: list[TeacherSkill] = Field(default_factory=list)
    academic_records: list[TeacherAcademicRecord] = Field(default_factory=list)
    experiences: list[TeacherExperience] = Field(default_factory=list)
    availability: list[TeacherAvailabilityRule] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class TeacherProfileUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    first_name: str | None = None
    last_name: str | None = None
    phone: str | None = None
    cpf: str | None = None
    professional_number: str | None = None
    modality: TeacherModality | None = None
    biography: str | None = None
    hourly_rate_cents: int | None = Field(default=None, ge=0)
    lesson_duration_minutes: int | None = Field(default=None, ge=15, le=300)
    profile_photo_file_name: str | None = None
    hide_experience: bool | None = None
    address: AddressInput | None = None
    skills_ops: TeacherSkillsOps | None = None
    academic_records_ops: TeacherAcademicRecordsOps | None = None
    experiences_ops: TeacherExperiencesOps | None = None
    availability_ops: TeacherAvailabilityOps | None = None

    @model_validator(mode="after")
    def ensure_not_empty(self) -> "TeacherProfileUpdateRequest":
        if not self.model_fields_set:
            raise ValueError("Payload must include at least one field to patch.")
        return self
