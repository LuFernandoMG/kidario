from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Security, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.deps import get_current_admin
from app.core.config import get_settings
from app.core.security import AuthUser
from app.db.session import get_db
from app.schemas.admin import AdminAccessResponse, AdminDashboardResponse
from app.schemas.profiles import TeacherActivationPatch, TeacherActivationResponse
from app.services.admin_service import get_admin_dashboard
from app.services.profile_service import ProfileNotFoundError, set_teacher_activation

router = APIRouter(prefix="/admin", tags=["admin"])


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


@router.get("/dashboard", response_model=AdminDashboardResponse)
def get_admin_dashboard_endpoint(
    _: AuthUser = Security(get_current_admin),
    db: Session = Depends(get_db),
) -> AdminDashboardResponse:
    try:
        data = get_admin_dashboard(db)
    except SQLAlchemyError as exc:
        _raise_http_from_sql_error(exc)
    return AdminDashboardResponse(**data)


@router.get("/access", response_model=AdminAccessResponse)
def get_admin_access(
    _: AuthUser = Security(get_current_admin),
) -> AdminAccessResponse:
    return AdminAccessResponse()


@router.patch("/teachers/{profile_id}/activation", response_model=TeacherActivationResponse)
def patch_teacher_activation(
    profile_id: UUID,
    payload: TeacherActivationPatch,
    _: AuthUser = Security(get_current_admin),
    db: Session = Depends(get_db),
) -> TeacherActivationResponse:
    try:
        with db.begin():
            data = set_teacher_activation(db, profile_id, payload.is_active_teacher)
    except ProfileNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except SQLAlchemyError as exc:
        _raise_http_from_sql_error(exc)
    return TeacherActivationResponse(**data)
