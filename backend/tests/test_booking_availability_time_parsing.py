from datetime import time

from app.services.booking_v2_service import _time_to_minutes


def test_time_to_minutes_accepts_text_time_without_seconds() -> None:
    assert _time_to_minutes("12:30") == 750


def test_time_to_minutes_accepts_text_time_with_seconds() -> None:
    assert _time_to_minutes("12:30:00") == 750


def test_time_to_minutes_accepts_time_object() -> None:
    assert _time_to_minutes(time(12, 30)) == 750
