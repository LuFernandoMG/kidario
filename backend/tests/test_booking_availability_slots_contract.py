from datetime import date, datetime
from zoneinfo import ZoneInfo

from app.services.booking_v2_service import _availability_slot_day, _format_availability_date_label


def test_availability_slot_day_uses_frontend_contract_and_hh_mm_times() -> None:
    starts_at = [
        datetime(2026, 6, 1, 12, 0, tzinfo=ZoneInfo("America/Sao_Paulo")),
        datetime(2026, 6, 1, 14, 30, tzinfo=ZoneInfo("America/Sao_Paulo")),
    ]

    assert _availability_slot_day(date(2026, 6, 1), starts_at) == {
        "date_iso": "2026-06-01",
        "date_label": "Seg. 01/06",
        "times": ["12:00", "14:30"],
    }


def test_format_availability_date_label_uses_relative_labels() -> None:
    today = date(2026, 5, 30)

    assert _format_availability_date_label(today, today=today) == "Hoje"
    assert _format_availability_date_label(date(2026, 5, 31), today=today) == "Amanhã"
