from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from pydantic import ValidationError
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import get_db
from app.schemas.v2_auth import AuthSignupRequest, AuthSignupResponse
from app.services.auth_service import AuthSignupError, TeacherSignupProfilePhoto, signup_with_profile
from app.services.signup_protection_service import (
    SignupProtectionError,
    enforce_signup_protection,
    get_client_ip,
)

router = APIRouter(prefix="/auth", tags=["v2-auth"])


def _raise_http_from_sql_error(exc: SQLAlchemyError) -> None:
    sqlstate = getattr(getattr(exc, "orig", None), "sqlstate", None)
    if sqlstate == "42P01":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database schema not initialized. Run backend/sql migrations through 012.",
        ) from exc

    settings = get_settings()
    detail = "Database error."
    if settings.env != "production":
        detail = f"{detail} Reason: {exc}"
    raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=detail) from exc


@router.post("/signup", response_model=AuthSignupResponse, status_code=status.HTTP_201_CREATED)
def post_auth_signup(
    payload: AuthSignupRequest,
    request_obj: Request,
    db: Session = Depends(get_db),
) -> AuthSignupResponse:
    settings = get_settings()
    client_ip = get_client_ip(request_obj, settings)

    try:
        enforce_signup_protection(settings=settings, payload=payload, client_ip=client_ip)
        data = signup_with_profile(db, settings, payload)
    except SignupProtectionError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
    except AuthSignupError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
    except SQLAlchemyError as exc:
        _raise_http_from_sql_error(exc)
    return AuthSignupResponse(**data)


@router.post("/signup/teacher", response_model=AuthSignupResponse, status_code=status.HTTP_201_CREATED)
async def post_auth_teacher_signup(
    request_obj: Request,
    payload: str = Form(...),
    profile_photo: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> AuthSignupResponse:
    settings = get_settings()
    client_ip = get_client_ip(request_obj, settings)

    try:
        signup_payload = AuthSignupRequest.model_validate_json(payload)
    except ValidationError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=exc.errors()) from exc

    if signup_payload.role != "teacher":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="role must be 'teacher' for this endpoint.",
        )

    file_bytes = await profile_photo.read()

    try:
        enforce_signup_protection(settings=settings, payload=signup_payload, client_ip=client_ip)
        data = signup_with_profile(
            db,
            settings,
            signup_payload,
            teacher_profile_photo=TeacherSignupProfilePhoto(
                file_name=profile_photo.filename,
                content_type=profile_photo.content_type,
                file_bytes=file_bytes,
            ),
        )
    except SignupProtectionError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
    except AuthSignupError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
    except SQLAlchemyError as exc:
        _raise_http_from_sql_error(exc)
    return AuthSignupResponse(**data)
