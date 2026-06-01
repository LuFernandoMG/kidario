from types import SimpleNamespace

from sqlalchemy.exc import SQLAlchemyError

from app.services import teacher_activity_planner_service as planner
from app.services.teacher_activity_planner_service import (
    TeacherActivityPlanInput,
    get_or_create_teacher_activity_plan_for_booking,
)


class _DummyNestedTransaction:
    def __init__(self, db) -> None:
        self._db = db

    def __enter__(self):
        self._db.begin_nested_calls += 1
        return self

    def __exit__(self, exc_type, exc, tb) -> bool:
        self._db.exits.append(exc_type)
        return False


class _DummySession:
    def __init__(self) -> None:
        self.begin_nested_calls = 0
        self.exits = []

    def begin_nested(self):
        return _DummyNestedTransaction(self)


def _settings():
    return SimpleNamespace(
        teacher_activity_llm_enabled=False,
        teacher_activity_llm_api_key=None,
    )


def _planner_input() -> TeacherActivityPlanInput:
    return TeacherActivityPlanInput(
        child_name="Luca",
        child_age=8,
        completed_lessons_with_child=0,
        objectives=["Leitura"],
        parent_focus_points=[],
        latest_follow_up_summary=None,
    )


def test_activity_plan_cache_failure_uses_savepoint_and_falls_back(monkeypatch) -> None:
    db = _DummySession()

    def _raise_cache_error(_db, _booking_id):
        raise SQLAlchemyError("booking_activity_plans is not available")

    monkeypatch.setattr(planner, "_load_cached_plan_row", _raise_cache_error)

    plan = get_or_create_teacher_activity_plan_for_booking(
        db=db,
        booking_id="booking-id",
        teacher_id="teacher-id",
        child_id="child-id",
        planner_input=_planner_input(),
        settings=_settings(),
    )

    assert plan["source"] == "fallback"
    assert plan["activities"]
    assert db.begin_nested_calls == 1
    assert db.exits == [SQLAlchemyError]


def test_activity_plan_persist_failure_uses_savepoint_and_keeps_generated_plan(monkeypatch) -> None:
    db = _DummySession()

    monkeypatch.setattr(planner, "_load_cached_plan_row", lambda _db, _booking_id: None)

    def _raise_persist_error(**_kwargs):
        raise SQLAlchemyError("booking_activity_plans cannot be written")

    monkeypatch.setattr(planner, "_persist_booking_activity_plan", _raise_persist_error)

    plan = get_or_create_teacher_activity_plan_for_booking(
        db=db,
        booking_id="booking-id",
        teacher_id="teacher-id",
        child_id="child-id",
        planner_input=_planner_input(),
        settings=_settings(),
    )

    assert plan["source"] == "fallback"
    assert plan["activities"]
    assert db.begin_nested_calls == 2
    assert db.exits == [None, SQLAlchemyError]
