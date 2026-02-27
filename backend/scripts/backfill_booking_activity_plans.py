#!/usr/bin/env python3
from __future__ import annotations

import argparse
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
import sys
from typing import Iterable
from uuid import UUID

from sqlalchemy import text

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.core.security import AuthUser
from app.db.session import get_session_maker
from app.services.booking_service import ensure_teacher_activity_plan_for_booking

ALLOWED_STATUSES = {"confirmada", "concluida"}
SessionLocal = get_session_maker()


@dataclass
class BookingRow:
    id: UUID
    teacher_profile_id: UUID
    status: str
    date_iso: str
    time: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Backfill de planos de atividade por agenda (booking_activity_plans).",
    )
    parser.add_argument(
        "--teacher-id",
        help="Filtrar por um teacher_profile_id específico (UUID).",
    )
    parser.add_argument(
        "--statuses",
        default="confirmada,concluida",
        help="Lista CSV de status para processar. Padrão: confirmada e concluida.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Máximo de agendas a processar (0 = sem limite).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Somente mostra quantas agendas seriam processadas.",
    )
    return parser.parse_args()


def normalize_statuses(raw_statuses: str) -> list[str]:
    statuses = [item.strip().lower() for item in raw_statuses.split(",") if item.strip()]
    if not statuses:
        raise ValueError("Você deve informar ao menos um status em --statuses.")

    invalid = [item for item in statuses if item not in ALLOWED_STATUSES]
    if invalid:
        raise ValueError(
            f"Status inválidos em --statuses: {', '.join(invalid)}. "
            f"Permitidos: {', '.join(sorted(ALLOWED_STATUSES))}"
        )
    return statuses


def load_candidate_bookings(
    *,
    teacher_id: str | None,
    statuses: Iterable[str],
    limit: int,
) -> list[BookingRow]:
    where_clauses = ["b.status = any(:statuses)"]
    params: dict[str, object] = {"statuses": list(statuses)}

    if teacher_id:
        where_clauses.append("b.teacher_profile_id = :teacher_id")
        params["teacher_id"] = teacher_id

    limit_clause = "limit :limit_rows" if limit > 0 else ""
    if limit > 0:
        params["limit_rows"] = int(limit)

    query = text(
        f"""
        select
          b.id,
          b.teacher_profile_id,
          b.status,
          b.date_iso,
          b.time
        from bookings b
        where {' and '.join(where_clauses)}
        order by b.teacher_profile_id asc, b.date_iso asc, b.time asc
        {limit_clause}
        """
    )

    with SessionLocal() as db:
        rows = db.execute(query, params).mappings().all()

    return [
        BookingRow(
            id=UUID(str(row["id"])),
            teacher_profile_id=UUID(str(row["teacher_profile_id"])),
            status=str(row["status"]),
            date_iso=str(row["date_iso"]),
            time=str(row["time"]),
        )
        for row in rows
    ]


def ensure_activity_plan_table_exists() -> None:
    with SessionLocal() as db:
        exists = db.execute(
            text("select to_regclass('public.booking_activity_plans') is not null"),
        ).scalar()
    if not bool(exists):
        raise RuntimeError(
            "Tabela booking_activity_plans não encontrada. "
            "Aplique a migration sql/010_add_booking_activity_plans.sql antes do backfill."
        )


def main() -> int:
    args = parse_args()

    try:
        statuses = normalize_statuses(args.statuses)
        if args.teacher_id:
            UUID(args.teacher_id)
    except ValueError as exc:
        print(f"[error] {exc}")
        return 2

    try:
        ensure_activity_plan_table_exists()
    except RuntimeError as exc:
        print(f"[error] {exc}")
        return 2

    bookings = load_candidate_bookings(
        teacher_id=args.teacher_id,
        statuses=statuses,
        limit=max(0, int(args.limit)),
    )

    status_counter = Counter(booking.status for booking in bookings)
    print(f"[info] Agendas candidatas: {len(bookings)}")
    print(f"[info] Por status: {dict(status_counter)}")

    if args.dry_run:
        print("[info] Dry-run finalizado sem escrita.")
        return 0

    generated_counter = Counter()
    errors: list[str] = []

    with SessionLocal() as db:
        for index, booking in enumerate(bookings, start=1):
            try:
                response = ensure_teacher_activity_plan_for_booking(
                    db,
                    AuthUser(
                        user_id=str(booking.teacher_profile_id),
                        email=None,
                        role="authenticated",
                    ),
                    booking.id,
                )
                source = str(response.get("activity_plan_source") or "fallback")
                generated_counter[source] += 1
                print(
                    f"[{index}/{len(bookings)}] {booking.id} {booking.status} "
                    f"{booking.date_iso} {booking.time} -> {source}"
                )
            except Exception as exc:  # noqa: BLE001
                message = f"{booking.id}: {exc}"
                errors.append(message)
                print(f"[error] {message}")

    print(f"[done] Processadas: {len(bookings)}")
    print(f"[done] Fontes geradas: {dict(generated_counter)}")
    print(f"[done] Erros: {len(errors)}")

    if errors:
        print("[error] Backfill finalizado com erros.")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
