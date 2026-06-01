from datetime import date, time

from app.services.explore_v2_service import _build_slot_datetime, _time_to_minutes


def test_explore_time_to_minutes_accepts_text_time_without_seconds() -> None:
    assert _time_to_minutes("12:30") == 750


def test_explore_time_to_minutes_accepts_text_time_with_seconds() -> None:
    assert _time_to_minutes("12:30:00") == 750


def test_explore_time_to_minutes_accepts_time_object() -> None:
    assert _time_to_minutes(time(12, 30)) == 750


def test_explore_slot_datetime_accepts_text_time_with_seconds() -> None:
    slot = _build_slot_datetime(date(2026, 5, 30), "12:30:00")

    assert slot.hour == 12
    assert slot.minute == 30
