from fastapi import APIRouter, Depends, HTTPException, Query, Security, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.deps import get_current_teacher_user
from app.core.config import get_settings
from app.core.security import AuthUser
from app.db.session import get_db
from app.schemas.teacher_control import TeacherControlCenterOverviewResponse
from app.services.teacher_control_service import (
    TeacherControlPermissionError,
    get_teacher_control_center_overview,
)

router = APIRouter(prefix="/teacher", tags=["teacher"])


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


@router.get("/control-center/overview", response_model=TeacherControlCenterOverviewResponse)
def get_control_center_overview(
    limit_agenda: int = Query(default=8, ge=1, le=30),
    limit_chats: int = Query(default=8, ge=1, le=30),
    limit_students: int = Query(default=8, ge=1, le=30),
    user: AuthUser = Security(get_current_teacher_user),
    db: Session = Depends(get_db),
) -> TeacherControlCenterOverviewResponse:
    try:
        data = get_teacher_control_center_overview(
            db,
            user,
            limit_agenda=limit_agenda,
            limit_chats=limit_chats,
            limit_students=limit_students,
        )
    except TeacherControlPermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except SQLAlchemyError as exc:
        _raise_http_from_sql_error(exc)
    return TeacherControlCenterOverviewResponse(**data)
