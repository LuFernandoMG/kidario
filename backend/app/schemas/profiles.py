from datetime import date
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class ProfileView(BaseModel):
    id: UUID
    email: str
    first_name: str | None = None
    last_name: str | None = None
    role: str


class MeResponse(BaseModel):
    profile: ProfileView
    parent_profile_exists: bool
    teacher_profile_exists: bool


class StatusResponse(BaseModel):
    status: str = "ok"
    profile_id: UUID
    role: str


class ChildUpsert(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID | None = None
    name: str
    gender: str | None = None
    age: int | None = None
    current_grade: str | None = None
    birth_month_year: str | None = None
    school: str | None = None
    focus_points: str | None = None

    @field_validator("birth_month_year")
    @classmethod
    def validate_birth_month_year(cls, value: str | None) -> str | None:
        if value is None:
            return value
        if len(value) != 7 or value[4] != "-":
            raise ValueError("birth_month_year must have format YYYY-MM.")
        return value


class ParentChildrenOps(BaseModel):
    model_config = ConfigDict(extra="forbid")

    upsert: list[ChildUpsert] = Field(default_factory=list)
    delete_ids: list[UUID] = Field(default_factory=list)


class ParentProfilePatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    first_name: str | None = None
    last_name: str | None = None
    phone: str | None = None
    birth_date: date | None = None
    address: str | None = None
    bio: str | None = None
    children_ops: ParentChildrenOps | None = None

    @model_validator(mode="after")
    def ensure_not_empty(self) -> "ParentProfilePatch":
        has_values = any(
            [
                self.first_name is not None,
                self.last_name is not None,
                self.phone is not None,
                self.birth_date is not None,
                self.address is not None,
                self.bio is not None,
                self.children_ops is not None,
            ]
        )
        if not has_values:
            raise ValueError("Payload must include at least one field to patch.")
        return self


class TeacherSpecialtiesOps(BaseModel):
    model_config = ConfigDict(extra="forbid")

    add: list[str] = Field(default_factory=list)
    remove: list[str] = Field(default_factory=list)


class TeacherFormationUpsert(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID | None = None
    degree_type: str
    course_name: str
    institution: str
    completion_year: str | None = None


class TeacherFormationsOps(BaseModel):
    model_config = ConfigDict(extra="forbid")

    upsert: list[TeacherFormationUpsert] = Field(default_factory=list)
    delete_ids: list[UUID] = Field(default_factory=list)


class TeacherExperienceUpsert(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID | None = None
    institution: str
    role: str
    responsibilities: str
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
    start_time: str
    end_time: str


class TeacherAvailabilityOps(BaseModel):
    model_config = ConfigDict(extra="forbid")

    upsert: list[TeacherAvailabilityUpsert] = Field(default_factory=list)
    delete_ids: list[UUID] = Field(default_factory=list)


class TeacherProfilePatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    first_name: str | None = None
    last_name: str | None = None
    phone: str | None = None
    cpf: str | None = None
    professional_registration: str | None = None
    city: str | None = None
    state: str | None = None
    modality: str | None = None
    mini_bio: str | None = None
    hourly_rate: float | None = None
    lesson_duration_minutes: int | None = None
    profile_photo_file_name: str | None = None
    request_experience_anonymity: bool | None = None
    specialties_ops: TeacherSpecialtiesOps | None = None
    formations_ops: TeacherFormationsOps | None = None
    experiences_ops: TeacherExperiencesOps | None = None
    availability_ops: TeacherAvailabilityOps | None = None

    @model_validator(mode="after")
    def ensure_not_empty(self) -> "TeacherProfilePatch":
        has_values = any(
            [
                self.first_name is not None,
                self.last_name is not None,
                self.phone is not None,
                self.cpf is not None,
                self.professional_registration is not None,
                self.city is not None,
                self.state is not None,
                self.modality is not None,
                self.mini_bio is not None,
                self.hourly_rate is not None,
                self.lesson_duration_minutes is not None,
                self.profile_photo_file_name is not None,
                self.request_experience_anonymity is not None,
                self.specialties_ops is not None,
                self.formations_ops is not None,
                self.experiences_ops is not None,
                self.availability_ops is not None,
            ]
        )
        if not has_values:
            raise ValueError("Payload must include at least one field to patch.")
        return self


class TeacherActivationPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    is_active_teacher: bool


class TeacherActivationResponse(BaseModel):
    status: str = "ok"
    profile_id: UUID
    is_active_teacher: bool

