from datetime import date
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class UserView(BaseModel):
    id: UUID
    email: str
    first_name: str
    last_name: str
    role: str
    auth_email_confirmed: bool = False


class AddressView(BaseModel):
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


class AddressPatch(BaseModel):
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


class MeResponse(BaseModel):
    user: UserView
    role: str
    parent_id: UUID | None = None
    teacher_id: UUID | None = None


class ChildView(BaseModel):
    id: UUID
    parent_id: UUID
    name: str
    gender: str | None = None
    birth_month_year: date | None = None
    current_grade: str | None = None
    school: str | None = None
    focus_points: str | None = None


class ParentView(BaseModel):
    id: UUID
    user_id: UUID
    address_id: UUID
    phone: str
    cpf: str
    birth_date: date
    bio: str | None = None


class ParentProfileResponse(BaseModel):
    user: UserView
    parent: ParentView
    address: AddressView
    children: list[ChildView] = Field(default_factory=list)


class AcademicRecordView(BaseModel):
    id: UUID
    teacher_id: UUID
    degree_type: str
    course_name: str
    institution: str
    completion_year: str | None = None


class TeacherExperienceView(BaseModel):
    id: UUID
    teacher_id: UUID
    institution: str
    role: str
    description: str
    period_from: str
    period_to: str | None = None
    current_position: bool


class TeacherAvailabilityView(BaseModel):
    id: UUID
    teacher_id: UUID
    day_of_week: int
    start_time: str
    end_time: str


class TeacherView(BaseModel):
    id: UUID
    user_id: UUID
    address_id: UUID
    phone: str | None = None
    cpf: str
    professional_number: str | None = None
    modality: str | None = None
    biography: str | None = None
    hourly_rate_cents: int | None = None
    lesson_duration_minutes: int | None = None
    profile_photo_file_name: str | None = None
    hide_experience: bool = False
    is_active: bool = False


class TeacherProfileResponse(BaseModel):
    user: UserView
    teacher: TeacherView
    address: AddressView
    skills: list[str] = Field(default_factory=list)
    academic_records: list[AcademicRecordView] = Field(default_factory=list)
    experiences: list[TeacherExperienceView] = Field(default_factory=list)
    availability: list[TeacherAvailabilityView] = Field(default_factory=list)


class StatusResponse(BaseModel):
    status: str = "ok"
    user_id: UUID
    role: str
    parent_id: UUID | None = None
    teacher_id: UUID | None = None


class TeacherProfilePhotoUploadResponse(StatusResponse):
    profile_photo_file_name: str


class ChildUpsert(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID | None = None
    name: str
    gender: str | None = None
    birth_month_year: date | None = None
    current_grade: str | None = None
    school: str | None = None
    focus_points: str | None = None


class ParentChildrenOps(BaseModel):
    model_config = ConfigDict(extra="forbid")

    upsert: list[ChildUpsert] = Field(default_factory=list)
    delete_ids: list[UUID] = Field(default_factory=list)


class ParentProfilePatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    first_name: str | None = None
    last_name: str | None = None
    phone: str | None = None
    cpf: str | None = None
    birth_date: date | None = None
    address: AddressPatch | None = None
    bio: str | None = None
    children_ops: ParentChildrenOps | None = None

    @model_validator(mode="after")
    def ensure_not_empty(self) -> "ParentProfilePatch":
        if not any(
            value is not None
            for value in [
                self.first_name,
                self.last_name,
                self.phone,
                self.cpf,
                self.birth_date,
                self.address,
                self.bio,
                self.children_ops,
            ]
        ):
            raise ValueError("Payload must include at least one field to patch.")
        return self


class TeacherSkillsOps(BaseModel):
    model_config = ConfigDict(extra="forbid")

    add: list[str] = Field(default_factory=list)
    remove: list[str] = Field(default_factory=list)


class AcademicRecordUpsert(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID | None = None
    degree_type: str
    course_name: str
    institution: str
    completion_year: str | None = None


class AcademicRecordsOps(BaseModel):
    model_config = ConfigDict(extra="forbid")

    upsert: list[AcademicRecordUpsert] = Field(default_factory=list)
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
    professional_number: str | None = None
    address: AddressPatch | None = None
    modality: str | None = None
    biography: str | None = None
    hourly_rate_cents: int | None = Field(default=None, ge=0)
    lesson_duration_minutes: int | None = Field(default=None, ge=15, le=300)
    profile_photo_file_name: str | None = None
    hide_experience: bool | None = None
    skills_ops: TeacherSkillsOps | None = None
    academic_records_ops: AcademicRecordsOps | None = None
    experiences_ops: TeacherExperiencesOps | None = None
    availability_ops: TeacherAvailabilityOps | None = None

    @model_validator(mode="after")
    def ensure_not_empty(self) -> "TeacherProfilePatch":
        if not any(
            value is not None
            for value in [
                self.first_name,
                self.last_name,
                self.phone,
                self.cpf,
                self.professional_number,
                self.address,
                self.modality,
                self.biography,
                self.hourly_rate_cents,
                self.lesson_duration_minutes,
                self.profile_photo_file_name,
                self.hide_experience,
                self.skills_ops,
                self.academic_records_ops,
                self.experiences_ops,
                self.availability_ops,
            ]
        ):
            raise ValueError("Payload must include at least one field to patch.")
        return self


class TeacherActivationPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    is_active: bool


class TeacherActivationResponse(BaseModel):
    status: str = "ok"
    teacher_id: UUID
    is_active: bool
