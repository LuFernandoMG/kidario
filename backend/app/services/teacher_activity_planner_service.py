from __future__ import annotations

import json
import re
from dataclasses import dataclass
from urllib import error, request

from app.core.config import Settings, get_settings


@dataclass
class TeacherActivityPlanInput:
    child_name: str
    child_age: int | None
    completed_lessons_with_child: int
    objectives: list[str]
    parent_focus_points: list[str]
    latest_follow_up_summary: str | None


def generate_teacher_activity_plan(
    planner_input: TeacherActivityPlanInput,
    settings: Settings | None = None,
) -> dict:
    resolved_settings = settings or get_settings()
    fallback_activities = _build_fallback_activities(planner_input)

    if not resolved_settings.teacher_activity_llm_enabled:
        return {"source": "fallback", "activities": fallback_activities}
    if not resolved_settings.teacher_activity_llm_api_key:
        return {"source": "fallback", "activities": fallback_activities}

    llm_activities = _generate_with_openai(resolved_settings, planner_input)
    if llm_activities:
        return {"source": "llm", "activities": llm_activities}
    return {"source": "fallback", "activities": fallback_activities}


def _generate_with_openai(
    settings: Settings,
    planner_input: TeacherActivityPlanInput,
) -> list[str]:
    base_url = settings.teacher_activity_llm_base_url.rstrip("/")
    url = f"{base_url}/chat/completions"

    system_prompt = (
        "Você é uma assistente pedagógica. Gere no máximo 3 atividades curtas, práticas e "
        "adaptadas ao objetivo da aula. Responda apenas em JSON com a chave 'activities'."
    )
    user_prompt = _build_user_prompt(planner_input)
    payload = json.dumps(
        {
            "model": settings.teacher_activity_llm_model,
            "temperature": 0.4,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        }
    ).encode("utf-8")

    req = request.Request(
        url,
        data=payload,
        headers={
            "Authorization": f"Bearer {settings.teacher_activity_llm_api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with request.urlopen(req, timeout=settings.teacher_activity_llm_timeout_seconds) as response:
            raw_response = response.read().decode("utf-8")
    except (error.HTTPError, error.URLError, TimeoutError):
        return []

    try:
        parsed_response = json.loads(raw_response)
        content = (
            parsed_response.get("choices", [{}])[0]
            .get("message", {})
            .get("content", "")
        )
    except (KeyError, IndexError, TypeError, json.JSONDecodeError):
        return []

    return _extract_activity_list(content)


def _build_user_prompt(planner_input: TeacherActivityPlanInput) -> str:
    is_first_lesson_with_child = planner_input.completed_lessons_with_child == 0
    child_age = f"{planner_input.child_age} anos" if planner_input.child_age is not None else "idade não informada"
    objectives_text = "; ".join(planner_input.objectives) if planner_input.objectives else "sem objetivo definido"
    focus_points_text = (
        "; ".join(planner_input.parent_focus_points)
        if planner_input.parent_focus_points
        else "nenhum ponto de melhoria informado"
    )
    follow_up_text = planner_input.latest_follow_up_summary or "sem devolutiva anterior registrada"

    return (
        f"Aluno: {planner_input.child_name} ({child_age}). "
        f"Aulas concluídas com a professora: {planner_input.completed_lessons_with_child}. "
        f"Primeira aula? {'sim' if is_first_lesson_with_child else 'não'}. "
        f"Objetivos da aula: {objectives_text}. "
        f"Pontos de melhoria da família: {focus_points_text}. "
        f"Resumo da evolução recente: {follow_up_text}. "
        "Responda com JSON no formato: {\"activities\": [\"...\", \"...\", \"...\"]}."
    )


def _extract_activity_list(raw_content: str) -> list[str]:
    normalized = raw_content.strip()
    if not normalized:
        return []

    if normalized.startswith("```"):
        normalized = re.sub(r"^```[a-zA-Z]*\n?", "", normalized)
        normalized = re.sub(r"\n?```$", "", normalized)
        normalized = normalized.strip()

    try:
        parsed_json = json.loads(normalized)
        if isinstance(parsed_json, dict):
            activities = parsed_json.get("activities")
            if isinstance(activities, list):
                cleaned = [str(item).strip() for item in activities if str(item).strip()]
                return cleaned[:3]
    except json.JSONDecodeError:
        pass

    lines: list[str] = []
    for raw_line in normalized.splitlines():
        line = re.sub(r"^\s*[-*•\d\.\)]\s*", "", raw_line).strip()
        if line:
            lines.append(line)
    return lines[:3]


def _build_fallback_activities(planner_input: TeacherActivityPlanInput) -> list[str]:
    is_first_lesson_with_child = planner_input.completed_lessons_with_child == 0
    primary_objective = planner_input.objectives[0] if planner_input.objectives else "Consolidar habilidades da aula"
    primary_focus = (
        planner_input.parent_focus_points[0]
        if planner_input.parent_focus_points
        else "engajamento e autonomia"
    )

    if is_first_lesson_with_child:
        return [
            f"Observação guiada para validar o diagnóstico inicial sobre {primary_focus}.",
            "Atividade curta de sondagem para mapear repertório e dificuldades reais do aluno.",
            "Fechamento com devolutiva estruturada e próximos passos para as próximas aulas.",
        ]

    return [
        f"Revisão ativa do objetivo principal: {primary_objective}.",
        f"Exercício prático focado em {primary_focus}, com dificuldade progressiva.",
        "Encerramento com registro de evidências e definição de metas da próxima sessão.",
    ]
