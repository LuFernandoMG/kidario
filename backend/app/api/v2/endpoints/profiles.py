from collections.abc import Callable
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Security, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.security import AuthUser
from app.db.session import get_db
from app.schemas.v2_profiles import (
    Child,
    ChildCreateRequest,
    ChildUpdateRequest,
    ChildrenResponse,
    DeleteChildResponse,
    MeResponse,
    MeUpdateRequest,
    ParentProfile,
    ParentProfileUpdateRequest,
    TeacherProfile,
    TeacherProfileUpdateRequest,
)
from app.services.profile_service import ProfileConflictError, ProfileNotFoundError, ProfileValidationError
from app.services.profile_v2_service import (
    create_child_v2,
    delete_child_v2,
    get_me_v2,
    get_parent_profile_v2,
    get_teacher_profile_v2,
    list_my_children_v2,
    update_child_v2,
    update_me_v2,
    update_parent_profile_v2,
    update_teacher_profile_v2,
)

router = APIRouter(tags=["v2-profiles"])


def _raise_http_from_sql_error(exc: SQLAlchemyError) -> None:
    sqlstate = getattr(getattr(exc, "orig", None), "sqlstate", None)
    if sqlstate == "42P01":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database schema not initialized. Run backend/sql migrations through 012.",
        ) from exc
    if sqlstate == "23505":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A record with these unique fields already exists.",
        ) from exc

    settings = get_settings()
    detail = "Database error."
    if settings.env != "production":
        detail = f"{detail} Reason: {exc}"
    raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=detail) from exc


def _run_write_transaction(db: Session, operation: Callable[[], dict]) -> dict:
    if hasattr(db, "in_transaction") and db.in_transaction():
        try:
            data = operation()
            db.commit()
            return data
        except Exception:
            db.rollback()
            raise
    with db.begin():
        return operation()


def _handle_profile_error(exc: Exception) -> None:
    if isinstance(exc, ProfileNotFoundError):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    if isinstance(exc, ProfileConflictError):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    if isinstance(exc, ProfileValidationError):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    if isinstance(exc, SQLAlchemyError):
        _raise_http_from_sql_error(exc)
    raise exc


@router.get("/me", response_model=MeResponse)
def get_me_endpoint(
    user: AuthUser = Security(get_current_user),
    db: Session = Depends(get_db),
) -> MeResponse:
    try:
        data = get_me_v2(db, user)
    except Exception as exc:
        _handle_profile_error(exc)
    return MeResponse(**data)


@router.patch("/me", response_model=MeResponse)
def patch_me_endpoint(
    payload: MeUpdateRequest,
    user: AuthUser = Security(get_current_user),
    db: Session = Depends(get_db),
) -> MeResponse:
    try:
        data = _run_write_transaction(db, lambda: update_me_v2(db, user, payload))
    except Exception as exc:
        _handle_profile_error(exc)
    return MeResponse(**data)


@router.get("/parents/me", response_model=ParentProfile)
def get_my_parent_profile_endpoint(
    user: AuthUser = Security(get_current_user),
    db: Session = Depends(get_db),
) -> ParentProfile:
    try:
        data = get_parent_profile_v2(db, user)
    except Exception as exc:
        _handle_profile_error(exc)
    return ParentProfile(**data)


@router.patch("/parents/me", response_model=ParentProfile)
def patch_my_parent_profile_endpoint(
    payload: ParentProfileUpdateRequest,
    user: AuthUser = Security(get_current_user),
    db: Session = Depends(get_db),
) -> ParentProfile:
    try:
        data = _run_write_transaction(db, lambda: update_parent_profile_v2(db, user, payload))
    except Exception as exc:
        _handle_profile_error(exc)
    return ParentProfile(**data)


@router.get("/parents/me/children", response_model=ChildrenResponse)
def list_my_children_endpoint(
    user: AuthUser = Security(get_current_user),
    db: Session = Depends(get_db),
) -> ChildrenResponse:
    try:
        data = list_my_children_v2(db, user)
    except Exception as exc:
        _handle_profile_error(exc)
    return ChildrenResponse(**data)


@router.post("/parents/me/children", response_model=Child, status_code=status.HTTP_201_CREATED)
def create_child_endpoint(
    payload: ChildCreateRequest,
    user: AuthUser = Security(get_current_user),
    db: Session = Depends(get_db),
) -> Child:
    try:
        data = _run_write_transaction(db, lambda: create_child_v2(db, user, payload))
    except Exception as exc:
        _handle_profile_error(exc)
    return Child(**data)


@router.patch("/parents/me/children/{child_id}", response_model=Child)
def patch_child_endpoint(
    child_id: UUID,
    payload: ChildUpdateRequest,
    user: AuthUser = Security(get_current_user),
    db: Session = Depends(get_db),
) -> Child:
    try:
        data = _run_write_transaction(db, lambda: update_child_v2(db, user, child_id, payload))
    except Exception as exc:
        _handle_profile_error(exc)
    return Child(**data)


@router.delete("/parents/me/children/{child_id}", response_model=DeleteChildResponse)
def delete_child_endpoint(
    child_id: UUID,
    user: AuthUser = Security(get_current_user),
    db: Session = Depends(get_db),
) -> DeleteChildResponse:
    try:
        data = _run_write_transaction(db, lambda: delete_child_v2(db, user, child_id))
    except Exception as exc:
        _handle_profile_error(exc)
    return DeleteChildResponse(**data)


@router.get("/teachers/me", response_model=TeacherProfile)
def get_my_teacher_profile_endpoint(
    user: AuthUser = Security(get_current_user),
    db: Session = Depends(get_db),
) -> TeacherProfile:
    try:
        data = get_teacher_profile_v2(db, user)
    except Exception as exc:
        _handle_profile_error(exc)
    return TeacherProfile(**data)


@router.patch("/teachers/me", response_model=TeacherProfile)
def patch_my_teacher_profile_endpoint(
    payload: TeacherProfileUpdateRequest,
    user: AuthUser = Security(get_current_user),
    db: Session = Depends(get_db),
) -> TeacherProfile:
    try:
        data = _run_write_transaction(db, lambda: update_teacher_profile_v2(db, user, payload))
    except Exception as exc:
        _handle_profile_error(exc)
    return TeacherProfile(**data)
