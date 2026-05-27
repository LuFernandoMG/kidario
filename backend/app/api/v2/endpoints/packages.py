from collections.abc import Callable
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Security, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.deps import get_current_teacher_user, get_current_user
from app.core.config import get_settings
from app.core.security import AuthUser
from app.db.session import get_db
from app.schemas.v2_packages import (
    BookingPackage,
    BookingPackagesResponse,
    PackagePlan,
    PackagePlanCreateRequest,
    PackagePlansResponse,
    PackagePlanUpdateRequest,
    PackagePurchaseCreateRequest,
)
from app.services.package_v2_service import (
    PackageConflictError,
    PackageNotFoundError,
    PackagePermissionError,
    PackageValidationError,
    create_my_package_plan_v2,
    create_package_purchase_v2,
    list_my_package_plans_v2,
    list_parent_packages_v2,
    list_teacher_packages_v2,
    update_my_package_plan_v2,
)

router = APIRouter(tags=["v2-packages"])


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


def _handle_package_error(exc: Exception) -> None:
    if isinstance(exc, PackageNotFoundError):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    if isinstance(exc, PackagePermissionError):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    if isinstance(exc, PackageValidationError):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    if isinstance(exc, PackageConflictError):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    if isinstance(exc, SQLAlchemyError):
        _raise_http_from_sql_error(exc)
    raise exc


@router.get("/teachers/me/package-plans", response_model=PackagePlansResponse)
def list_my_package_plans_endpoint(
    user: AuthUser = Security(get_current_teacher_user),
    db: Session = Depends(get_db),
) -> PackagePlansResponse:
    try:
        data = list_my_package_plans_v2(db, user)
    except Exception as exc:
        _handle_package_error(exc)
    return PackagePlansResponse(**data)


@router.post("/teachers/me/package-plans", response_model=PackagePlan, status_code=status.HTTP_201_CREATED)
def create_my_package_plan_endpoint(
    payload: PackagePlanCreateRequest,
    user: AuthUser = Security(get_current_teacher_user),
    db: Session = Depends(get_db),
) -> PackagePlan:
    try:
        data = _run_write_transaction(db, lambda: create_my_package_plan_v2(db, user, payload))
    except Exception as exc:
        _handle_package_error(exc)
    return PackagePlan(**data)


@router.patch("/teachers/me/package-plans/{package_plan_id}", response_model=PackagePlan)
def patch_my_package_plan_endpoint(
    package_plan_id: UUID,
    payload: PackagePlanUpdateRequest,
    user: AuthUser = Security(get_current_teacher_user),
    db: Session = Depends(get_db),
) -> PackagePlan:
    try:
        data = _run_write_transaction(db, lambda: update_my_package_plan_v2(db, user, package_plan_id, payload))
    except Exception as exc:
        _handle_package_error(exc)
    return PackagePlan(**data)


@router.post("/packages/purchases", response_model=BookingPackage, status_code=status.HTTP_201_CREATED)
def create_package_purchase_endpoint(
    payload: PackagePurchaseCreateRequest,
    user: AuthUser = Security(get_current_user),
    db: Session = Depends(get_db),
) -> BookingPackage:
    try:
        data = _run_write_transaction(db, lambda: create_package_purchase_v2(db, user, payload))
    except Exception as exc:
        _handle_package_error(exc)
    return BookingPackage(**data)


@router.get("/parents/me/packages", response_model=BookingPackagesResponse)
def list_parent_packages_endpoint(
    user: AuthUser = Security(get_current_user),
    db: Session = Depends(get_db),
) -> BookingPackagesResponse:
    try:
        data = list_parent_packages_v2(db, user)
    except Exception as exc:
        _handle_package_error(exc)
    return BookingPackagesResponse(**data)


@router.get("/teachers/me/packages", response_model=BookingPackagesResponse)
def list_teacher_packages_endpoint(
    user: AuthUser = Security(get_current_teacher_user),
    db: Session = Depends(get_db),
) -> BookingPackagesResponse:
    try:
        data = list_teacher_packages_v2(db, user)
    except Exception as exc:
        _handle_package_error(exc)
    return BookingPackagesResponse(**data)
