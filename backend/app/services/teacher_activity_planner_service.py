from __future__ import annotations

import hashlib
import json
import re
import ssl
from dataclasses import dataclass
from urllib import error, request

import certifi
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

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


def get_or_create_teacher_activity_plan_for_booking(
    *,
    db: Session,
    booking_id: str,
    teacher_profile_id: str,
    child_id: str,
    planner_input: TeacherActivityPlanInput,
    settings: Settings | None = None,
) -> dict:
    resolved_settings = settings or get_settings()
    context_hash = _build_context_hash(planner_input)

    try:
        cached_plan_row = _load_cached_plan_row(db, booking_id)
    except SQLAlchemyError:
        return generate_teacher_activity_plan(planner_input, resolved_settings)

    if cached_plan_row:
        cached_activities = _normalize_activities_payload(cached_plan_row.get("activities"))
        if cached_activities and str(cached_plan_row.get("context_hash") or "") == context_hash:
            return {
                "source": str(cached_plan_row.get("source") or "fallback"),
                "activities": cached_activities,
            }

    generated_plan = generate_teacher_activity_plan(planner_input, resolved_settings)
    try:
        _persist_booking_activity_plan(
            db=db,
            booking_id=booking_id,
            teacher_profile_id=teacher_profile_id,
            child_id=child_id,
            source=str(generated_plan["source"]),
            activities=generated_plan["activities"],
            context_hash=context_hash,
        )
    except SQLAlchemyError:
        return generated_plan
    return generated_plan


def get_cached_teacher_activity_plan_for_booking(
    *,
    db: Session,
    booking_id: str,
) -> dict | None:
    try:
        cached_plan_row = _load_cached_plan_row(db, booking_id)
    except SQLAlchemyError:
        return None
    if not cached_plan_row:
        return None

    cached_activities = _normalize_activities_payload(cached_plan_row.get("activities"))
    return {
        "source": str(cached_plan_row.get("source") or "fallback"),
        "activities": cached_activities,
    }


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
    ssl_context = ssl.create_default_context(
        cafile=settings.teacher_activity_llm_ca_bundle or certifi.where()
    )

    try:
        with request.urlopen(
            req,
            timeout=settings.teacher_activity_llm_timeout_seconds,
            context=ssl_context,
        ) as response:
            raw_response = response.read().decode("utf-8")
    except (error.HTTPError, error.URLError, TimeoutError, ssl.SSLError):
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


def _build_context_hash(planner_input: TeacherActivityPlanInput) -> str:
    normalized_payload = {
        "child_name": planner_input.child_name.strip(),
        "child_age": planner_input.child_age,
        "completed_lessons_with_child": int(planner_input.completed_lessons_with_child or 0),
        "objectives": [objective.strip() for objective in planner_input.objectives if objective.strip()],
        "parent_focus_points": [
            point.strip()
            for point in planner_input.parent_focus_points
            if point.strip()
        ],
        "latest_follow_up_summary": (planner_input.latest_follow_up_summary or "").strip(),
    }
    canonical = json.dumps(
        normalized_payload,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _load_cached_plan_row(db: Session, booking_id: str) -> dict | None:
    row = (
        db.execute(
            text(
                """
                select source, activities, context_hash
                from booking_activity_plans
                where booking_id = :booking_id
                limit 1
                """
            ),
            {"booking_id": booking_id},
        )
        .mappings()
        .first()
    )
    return dict(row) if row else None


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


def _normalize_activities_payload(raw_activities: object) -> list[str]:
    if isinstance(raw_activities, str):
        try:
            parsed = json.loads(raw_activities)
        except json.JSONDecodeError:
            return []
        raw_activities = parsed

    if not isinstance(raw_activities, list):
        return []

    normalized: list[str] = []
    for item in raw_activities:
        cleaned = str(item).strip()
        if cleaned:
            normalized.append(cleaned)
    return normalized[:3]


def _persist_booking_activity_plan(
    *,
    db: Session,
    booking_id: str,
    teacher_profile_id: str,
    child_id: str,
    source: str,
    activities: list[str],
    context_hash: str,
) -> None:
    bind = db.get_bind()
    with bind.begin() as connection:
        connection.execute(
            text(
                """
                insert into booking_activity_plans
                  (booking_id, teacher_profile_id, child_id, source, activities, context_hash, generated_at)
                values
                  (:booking_id, :teacher_profile_id, :child_id, :source, cast(:activities as jsonb), :context_hash, now())
                on conflict (booking_id)
                do update set
                  teacher_profile_id = excluded.teacher_profile_id,
                  child_id = excluded.child_id,
                  source = excluded.source,
                  activities = excluded.activities,
                  context_hash = excluded.context_hash,
                  generated_at = now(),
                  updated_at = now()
                """
            ),
            {
                "booking_id": booking_id,
                "teacher_profile_id": teacher_profile_id,
                "child_id": child_id,
                "source": source,
                "activities": json.dumps(activities, ensure_ascii=False),
                "context_hash": context_hash,
            },
        )


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
