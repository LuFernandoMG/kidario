from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import get_db
from app.schemas.auth import AuthSignupRequest, AuthSignupResponse
from app.services.auth_service import AuthSignupError, signup_with_profile

router = APIRouter(prefix="/auth", tags=["auth"])


def _raise_http_from_sql_error(exc: SQLAlchemyError) -> None:
    sqlstate = getattr(getattr(exc, "orig", None), "sqlstate", None)
    if sqlstate == "42P01":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database schema not initialized. Run backend/sql scripts.",
        ) from exc

    settings = get_settings()
    detail = "Database error."
    if settings.env != "production":
        detail = f"{detail} Reason: {exc}"
    raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=detail) from exc


@router.post("/signup", response_model=AuthSignupResponse, status_code=status.HTTP_201_CREATED)
def post_auth_signup(
    payload: AuthSignupRequest,
    db: Session = Depends(get_db),
) -> AuthSignupResponse:
    try:
        data = signup_with_profile(db, get_settings(), payload)
    except AuthSignupError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
    except SQLAlchemyError as exc:
        _raise_http_from_sql_error(exc)
    return AuthSignupResponse(**data)
