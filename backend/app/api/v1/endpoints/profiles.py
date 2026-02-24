from fastapi import APIRouter, Depends, File, HTTPException, Security, UploadFile, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.security import AuthUser
from app.db.session import get_db
from app.schemas.profiles import (
    MeResponse,
    ParentProfileResponse,
    ParentProfilePatch,
    StatusResponse,
    TeacherProfileResponse,
    TeacherProfilePatch,
    TeacherProfilePhotoUploadResponse,
)
from app.services.profile_photo_service import ProfilePhotoUploadError, upload_teacher_profile_photo
from app.services.profile_service import (
    ProfileConflictError,
    ProfileNotFoundError,
    ProfileValidationError,
    get_parent_profile,
    get_teacher_profile,
    get_me,
    patch_parent_profile,
    patch_teacher_profile,
)

router = APIRouter(prefix="/profiles", tags=["profiles"])


def _raise_http_from_sql_error(exc: SQLAlchemyError) -> None:
    sqlstate = getattr(getattr(exc, "orig", None), "sqlstate", None)
    if sqlstate == "42P01":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database schema not initialized. Run backend/sql/001_init_profiles.sql in Supabase SQL Editor.",
        ) from exc

    settings = get_settings()
    detail = "Database error."
    if settings.env != "production":
        detail = f"{detail} Reason: {exc}"
    raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=detail) from exc


@router.get("/me", response_model=MeResponse)
def get_my_profile(
    user: AuthUser = Security(get_current_user),
    db: Session = Depends(get_db),
) -> MeResponse:
    try:
        data = get_me(db, user)
    except ProfileNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except SQLAlchemyError as exc:
        _raise_http_from_sql_error(exc)
    return MeResponse(**data)


@router.get("/parent", response_model=ParentProfileResponse)
def get_parent(
    user: AuthUser = Security(get_current_user),
    db: Session = Depends(get_db),
) -> ParentProfileResponse:
    try:
        data = get_parent_profile(db, user)
    except ProfileNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ProfileConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except SQLAlchemyError as exc:
        _raise_http_from_sql_error(exc)
    return ParentProfileResponse(**data)


@router.get("/teacher", response_model=TeacherProfileResponse)
def get_teacher(
    user: AuthUser = Security(get_current_user),
    db: Session = Depends(get_db),
) -> TeacherProfileResponse:
    try:
        data = get_teacher_profile(db, user)
    except ProfileNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ProfileConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except SQLAlchemyError as exc:
        _raise_http_from_sql_error(exc)
    return TeacherProfileResponse(**data)


@router.patch("/parent", response_model=StatusResponse)
def patch_parent(
    payload: ParentProfilePatch,
    user: AuthUser = Security(get_current_user),
    db: Session = Depends(get_db),
) -> StatusResponse:
    try:
        with db.begin():
            data = patch_parent_profile(db, user, payload)
    except ProfileConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except ProfileValidationError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except SQLAlchemyError as exc:
        _raise_http_from_sql_error(exc)
    return StatusResponse(**data)


@router.patch("/teacher", response_model=StatusResponse)
def patch_teacher(
    payload: TeacherProfilePatch,
    user: AuthUser = Security(get_current_user),
    db: Session = Depends(get_db),
) -> StatusResponse:
    try:
        with db.begin():
            data = patch_teacher_profile(db, user, payload)
    except ProfileConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except ProfileValidationError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except SQLAlchemyError as exc:
        _raise_http_from_sql_error(exc)
    return StatusResponse(**data)


@router.post("/teacher/photo", response_model=TeacherProfilePhotoUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_teacher_photo(
    file: UploadFile = File(...),
    user: AuthUser = Security(get_current_user),
    db: Session = Depends(get_db),
) -> TeacherProfilePhotoUploadResponse:
    file_bytes = await file.read()
    try:
        with db.begin():
            data = upload_teacher_profile_photo(
                db,
                get_settings(),
                user,
                file_name=file.filename,
                content_type=file.content_type,
                file_bytes=file_bytes,
            )
    except ProfilePhotoUploadError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
    except ProfileConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except ProfileValidationError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except SQLAlchemyError as exc:
        _raise_http_from_sql_error(exc)
    return TeacherProfilePhotoUploadResponse(**data)
