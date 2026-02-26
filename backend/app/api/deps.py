from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import AuthUser, InvalidTokenError, get_jwt_verifier
from app.db.session import get_db

bearer_scheme = HTTPBearer(
    auto_error=False,
    scheme_name="SupabaseBearerAuth",
    description="Supabase access token. Formato: Bearer <token>",
)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Security(bearer_scheme),
) -> AuthUser:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token.",
        )

    verifier = get_jwt_verifier()
    try:
        user = verifier.verify(credentials.credentials)
    except InvalidTokenError as exc:
        settings = get_settings()
        detail = "Invalid or expired token."
        if settings.env != "production":
            detail = f"{detail} Reason: {exc}"
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
        ) from exc
    except Exception as exc:
        settings = get_settings()
        detail = "Invalid or expired token."
        if settings.env != "production":
            detail = f"{detail} Reason: {exc}"
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
        ) from exc

    if not user.user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token does not include subject.",
        )
    return user


def get_current_admin(user: AuthUser = Depends(get_current_user)) -> AuthUser:
    settings = get_settings()
    if not user.email or user.email.lower() not in settings.admin_email_set:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin permission required.",
        )
    return user


def _get_profile_role(db: Session, profile_id: str) -> str | None:
    return db.execute(
        text("select role from profiles where id = :profile_id"),
        {"profile_id": profile_id},
    ).scalar()


def get_current_teacher_user(
    user: AuthUser = Security(get_current_user),
    db: Session = Depends(get_db),
) -> AuthUser:
    role = _get_profile_role(db, user.user_id)
    if role != "teacher":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Teacher permission required.",
        )
    return user


def get_current_parent_user(
    user: AuthUser = Security(get_current_user),
    db: Session = Depends(get_db),
) -> AuthUser:
    role = _get_profile_role(db, user.user_id)
    if role != "parent":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Parent permission required.",
        )
    return user
