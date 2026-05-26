import json
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import AuthUser
from app.schemas.reviews import BookingReviewCreateRequest, ReviewModerationPatch
from app.services.identity_service import IdentityNotFoundError, get_actor_participant_ids, resolve_parent_id


class ReviewValidationError(Exception):
    pass


class ReviewConflictError(Exception):
    pass


class ReviewNotFoundError(Exception):
    pass


class ReviewPermissionError(Exception):
    pass


def _map_review_row(row: dict) -> dict:
    return {
        "id": row["id"],
        "booking_id": row["booking_id"],
        "parent_id": row["parent_id"],
        "teacher_id": row["teacher_id"],
        "rating": row["rating"],
        "comment": row["comment"],
        "feedback": row["feedback"] or {},
        "is_public": row["is_public"],
        "status": row["status"],
        "submitted_at": row["submitted_at"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def _load_booking_for_review(db: Session, booking_id: UUID) -> dict:
    row = (
        db.execute(
            text(
                """
                select id, parent_id, teacher_id, status
                from bookings
                where id = :booking_id
                """
            ),
            {"booking_id": str(booking_id)},
        )
        .mappings()
        .first()
    )
    if not row:
        raise ReviewNotFoundError("Booking not found.")
    return dict(row)


def _load_review_by_booking(db: Session, booking_id: UUID) -> dict | None:
    row = (
        db.execute(
            text(
                """
                select
                  br.id,
                  br.booking_id,
                  b.parent_id,
                  b.teacher_id,
                  br.rating,
                  br.comment,
                  br.feedback,
                  br.is_public,
                  br.status,
                  br.submitted_at,
                  br.created_at,
                  br.updated_at
                from booking_reviews br
                join bookings b on b.id = br.booking_id
                where br.booking_id = :booking_id
                """
            ),
            {"booking_id": str(booking_id)},
        )
        .mappings()
        .first()
    )
    return _map_review_row(dict(row)) if row else None


def create_booking_review(
    db: Session,
    user: AuthUser,
    booking_id: UUID,
    payload: BookingReviewCreateRequest,
) -> dict:
    try:
        parent_id = resolve_parent_id(db, user.user_id)
    except IdentityNotFoundError as exc:
        raise ReviewPermissionError("Only parent users can create reviews.") from exc
    booking = _load_booking_for_review(db, booking_id)
    if str(booking["parent_id"]) != str(parent_id):
        raise ReviewPermissionError("Only the parent owner can review this booking.")
    if booking["status"] != "concluida":
        raise ReviewValidationError("Only completed bookings can be reviewed.")

    try:
        row = (
            db.execute(
                text(
                    """
                    insert into booking_reviews (booking_id, rating, comment, feedback, is_public)
                    values (:booking_id, :rating, :comment, cast(:feedback as jsonb), :is_public)
                    returning id, booking_id, rating, comment, feedback, is_public, status, submitted_at, created_at, updated_at
                    """
                ),
                {
                    "booking_id": str(booking_id),
                    "rating": payload.rating,
                    "comment": payload.comment,
                    "feedback": json.dumps(payload.feedback),
                    "is_public": payload.is_public,
                },
            )
            .mappings()
            .first()
        )
    except IntegrityError as exc:
        sqlstate = getattr(getattr(exc, "orig", None), "sqlstate", None)
        if sqlstate == "23505":
            raise ReviewConflictError("Booking already has a review.") from exc
        raise
    if not row:
        raise ReviewValidationError("Could not create review.")

    return {
        **dict(row),
        "parent_id": booking["parent_id"],
        "teacher_id": booking["teacher_id"],
    }


def get_booking_review(db: Session, user: AuthUser, booking_id: UUID) -> dict:
    booking = _load_booking_for_review(db, booking_id)
    try:
        actor_parent_id, actor_teacher_id = get_actor_participant_ids(db, user.user_id)
    except IdentityNotFoundError as exc:
        raise ReviewPermissionError("You do not have access to this review.") from exc
    if str(booking["parent_id"]) != str(actor_parent_id) and str(booking["teacher_id"]) != str(actor_teacher_id):
        raise ReviewPermissionError("You do not have access to this review.")

    review = _load_review_by_booking(db, booking_id)
    if not review:
        raise ReviewNotFoundError("Review not found.")
    return review


def list_public_teacher_reviews(db: Session, teacher_id: UUID, *, limit: int = 30, offset: int = 0) -> dict:
    rows = (
        db.execute(
            text(
                """
                select
                  br.id,
                  br.booking_id,
                  b.parent_id,
                  b.teacher_id,
                  br.rating,
                  br.comment,
                  br.feedback,
                  br.is_public,
                  br.status,
                  br.submitted_at,
                  br.created_at,
                  br.updated_at
                from booking_reviews br
                join bookings b on b.id = br.booking_id
                where b.teacher_id = :teacher_id
                  and br.is_public = true
                  and br.status = 'published'
                order by br.submitted_at desc
                limit :limit
                offset :offset
                """
            ),
            {"teacher_id": str(teacher_id), "limit": limit, "offset": offset},
        )
        .mappings()
        .all()
    )
    return {"reviews": [_map_review_row(dict(row)) for row in rows]}


def list_admin_reviews(
    db: Session,
    *,
    status: str | None = None,
    teacher_id: UUID | None = None,
    parent_id: UUID | None = None,
    booking_id: UUID | None = None,
    limit: int = 100,
    offset: int = 0,
) -> dict:
    where_clauses = ["true"]
    params: dict[str, object] = {"limit": limit, "offset": offset}
    if status:
        where_clauses.append("br.status = :status")
        params["status"] = status
    if teacher_id:
        where_clauses.append("b.teacher_id = :teacher_id")
        params["teacher_id"] = str(teacher_id)
    if parent_id:
        where_clauses.append("b.parent_id = :parent_id")
        params["parent_id"] = str(parent_id)
    if booking_id:
        where_clauses.append("b.id = :booking_id")
        params["booking_id"] = str(booking_id)

    rows = (
        db.execute(
            text(
                f"""
                select
                  br.id,
                  br.booking_id,
                  b.parent_id,
                  b.teacher_id,
                  br.rating,
                  br.comment,
                  br.feedback,
                  br.is_public,
                  br.status,
                  br.submitted_at,
                  br.created_at,
                  br.updated_at
                from booking_reviews br
                join bookings b on b.id = br.booking_id
                where {' and '.join(where_clauses)}
                order by br.submitted_at desc
                limit :limit
                offset :offset
                """
            ),
            params,
        )
        .mappings()
        .all()
    )
    return {"reviews": [_map_review_row(dict(row)) for row in rows]}


def moderate_review(db: Session, review_id: UUID, payload: ReviewModerationPatch) -> dict:
    if payload.status is None and payload.is_public is None:
        raise ReviewValidationError("Payload must include status or is_public.")
    row = (
        db.execute(
            text(
                """
                update booking_reviews br
                set
                  status = coalesce(:status, status),
                  is_public = coalesce(:is_public, is_public),
                  updated_at = now()
                from bookings b
                where br.booking_id = b.id
                  and br.id = :review_id
                returning
                  br.id,
                  br.booking_id,
                  b.parent_id,
                  b.teacher_id,
                  br.rating,
                  br.comment,
                  br.feedback,
                  br.is_public,
                  br.status,
                  br.submitted_at,
                  br.created_at,
                  br.updated_at
                """
            ),
            {"review_id": str(review_id), "status": payload.status, "is_public": payload.is_public},
        )
        .mappings()
        .first()
    )
    if not row:
        raise ReviewNotFoundError("Review not found.")
    return _map_review_row(dict(row))
