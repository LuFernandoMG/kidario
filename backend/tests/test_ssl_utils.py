from types import SimpleNamespace
from urllib import error

import pytest

from app.core import ssl_utils
from app.services.teacher_activity_planner_service import (
    TeacherActivityPlanInput,
    generate_teacher_activity_plan,
)


def test_build_ssl_context_falls_back_when_configured_bundle_is_missing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[str | None] = []
    sentinel_context = object()

    def _fake_create_default_context(*, cafile=None):
        calls.append(cafile)
        if cafile == "/tmp/missing-ca.pem":
            raise FileNotFoundError("missing bundle")
        if cafile == "/tmp/certifi.pem":
            return sentinel_context
        raise AssertionError(f"Unexpected cafile: {cafile}")

    monkeypatch.setattr(ssl_utils.certifi, "where", lambda: "/tmp/certifi.pem")
    monkeypatch.setattr(ssl_utils.ssl, "create_default_context", _fake_create_default_context)

    context = ssl_utils.build_ssl_context("/tmp/missing-ca.pem")

    assert context is sentinel_context
    assert calls == ["/tmp/missing-ca.pem", "/tmp/certifi.pem"]


def test_generate_teacher_activity_plan_ignores_invalid_ca_bundle(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    planner_input = TeacherActivityPlanInput(
        child_name="Luca",
        child_age=8,
        completed_lessons_with_child=1,
        objectives=["Reforçar consciência fonológica"],
        parent_focus_points=["engajamento"],
        latest_follow_up_summary="Boa evolução na última aula.",
    )
    settings = SimpleNamespace(
        teacher_activity_llm_enabled=True,
        teacher_activity_llm_api_key="test-key",
        teacher_activity_llm_model="gpt-4o-mini",
        teacher_activity_llm_base_url="https://api.openai.com/v1",
        teacher_activity_llm_timeout_seconds=8.0,
        teacher_activity_llm_ca_bundle="/tmp/missing-ca.pem",
    )

    monkeypatch.setattr(ssl_utils.certifi, "where", lambda: "/tmp/certifi.pem")

    def _fake_create_default_context(*, cafile=None):
        if cafile == "/tmp/missing-ca.pem":
            raise FileNotFoundError("missing bundle")
        return object()

    def _fake_urlopen(*args, **kwargs):
        raise error.URLError("network down")

    monkeypatch.setattr(ssl_utils.ssl, "create_default_context", _fake_create_default_context)
    monkeypatch.setattr("app.services.teacher_activity_planner_service.request.urlopen", _fake_urlopen)

    plan = generate_teacher_activity_plan(planner_input, settings)

    assert plan["source"] == "fallback"
    assert len(plan["activities"]) == 3
