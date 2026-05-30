#!/usr/bin/env python
"""Sync a teacher payout profile with Pagar.me.

Run from backend/ so Settings loads backend/.env:

    PYTHONPATH=. .venv/bin/python scripts/sync_pagarme_recipient.py --email hello@luisfernando.io
"""

from __future__ import annotations

import argparse
import sys

from sqlalchemy import text

from app.core.config import get_settings
from app.core.security import AuthUser
from app.db.session import get_session_maker
from app.services.payment_v2_service import (
    PaymentPermissionError,
    PaymentValidationError,
    sync_teacher_payment_recipient_v2,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Sync a teacher payout recipient with Pagar.me.")
    selector = parser.add_mutually_exclusive_group(required=True)
    selector.add_argument("--email", help="Teacher account e-mail.")
    selector.add_argument("--user-id", help="Teacher auth/user UUID.")
    parser.add_argument(
        "--allow-live-key",
        action="store_true",
        help="Allow a non-test Pagar.me secret key. Use only outside test/sandbox runs.",
    )
    return parser.parse_args()


def require_test_pagarme_key(*, allow_live_key: bool) -> None:
    settings = get_settings()
    secret_key = (settings.pagarme_secret_key or "").strip()
    if not secret_key:
        raise RuntimeError(
            "KIDARIO_PAGARME_SECRET_KEY is not configured. Add the Pagar.me test secret key to backend/.env."
        )
    if not allow_live_key and "test" not in secret_key.lower():
        raise RuntimeError(
            "The configured Pagar.me secret key does not look like a test key. "
            "Pass --allow-live-key only if this is intentional."
        )


def load_teacher_user(*, email: str | None, user_id: str | None) -> AuthUser:
    query = """
        select u.id, u.email
        from users u
        join teachers t on t.user_id = u.id
        where {predicate}
        limit 1
    """
    predicate = "lower(u.email) = lower(:email)" if email else "u.id = :user_id"
    params = {"email": email, "user_id": user_id}

    session_factory = get_session_maker()
    with session_factory() as db:
        row = (
            db.execute(text(query.format(predicate=predicate)), params)
            .mappings()
            .first()
        )
        if not row:
            raise RuntimeError("Teacher user not found for the provided selector.")
        return AuthUser(user_id=str(row["id"]), email=str(row["email"]), role="authenticated")


def sync_recipient(user: AuthUser) -> dict:
    session_factory = get_session_maker()
    with session_factory() as db:
        try:
            data = sync_teacher_payment_recipient_v2(db, user)
            db.commit()
            return data
        except Exception:
            db.rollback()
            raise


def main() -> int:
    args = parse_args()
    try:
        require_test_pagarme_key(allow_live_key=args.allow_live_key)
        user = load_teacher_user(email=args.email, user_id=args.user_id)
        data = sync_recipient(user)
    except (RuntimeError, PaymentPermissionError, PaymentValidationError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    print("Pagar.me recipient synced.")
    print(f"teacher_id={data['teacher_id']}")
    print(f"provider={data['provider']}")
    print(f"provider_recipient_id={data['provider_recipient_id']}")
    print(f"recipient_status={data['recipient_status']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
