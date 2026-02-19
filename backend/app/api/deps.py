from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import get_settings
from app.core.security import AuthUser, InvalidTokenError, get_jwt_verifier

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
