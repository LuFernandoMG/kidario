import json
import ssl
from collections import deque
from threading import Lock
from time import monotonic
from urllib import error, parse, request

import certifi
from fastapi import Request

from app.core.config import Settings
from app.schemas.auth import AuthSignupRequest


class SignupProtectionError(Exception):
    def __init__(self, detail: str, status_code: int) -> None:
        super().__init__(detail)
        self.detail = detail
        self.status_code = status_code


class _InMemorySignupRateLimiter:
    def __init__(self) -> None:
        self._lock = Lock()
        self._attempts_by_ip: dict[str, deque[float]] = {}
        self._attempts_by_email: dict[str, deque[float]] = {}

    @staticmethod
    def _trim(queue: deque[float], *, cutoff: float) -> None:
        while queue and queue[0] < cutoff:
            queue.popleft()

    def check_and_mark_attempt(
        self,
        *,
        window_seconds: int,
        max_attempts_per_ip: int,
        max_attempts_per_email: int,
        client_ip: str,
        email: str,
    ) -> None:
        if window_seconds <= 0:
            return

        now = monotonic()
        cutoff = now - float(window_seconds)
        ip_key = (client_ip or "unknown").strip().lower()
        email_key = email.strip().lower()

        with self._lock:
            ip_queue = self._attempts_by_ip.setdefault(ip_key, deque())
            email_queue = self._attempts_by_email.setdefault(email_key, deque())
            self._trim(ip_queue, cutoff=cutoff)
            self._trim(email_queue, cutoff=cutoff)

            if max_attempts_per_ip > 0 and len(ip_queue) >= max_attempts_per_ip:
                raise SignupProtectionError(
                    "Muitas tentativas de cadastro deste IP. Tente novamente em alguns minutos.",
                    status_code=429,
                )
            if max_attempts_per_email > 0 and len(email_queue) >= max_attempts_per_email:
                raise SignupProtectionError(
                    "Muitas tentativas para este e-mail. Tente novamente em alguns minutos.",
                    status_code=429,
                )

            ip_queue.append(now)
            email_queue.append(now)


_signup_rate_limiter = _InMemorySignupRateLimiter()


def get_client_ip(request_obj: Request, settings: Settings) -> str:
    if settings.trust_proxy_headers:
        forwarded_for = request_obj.headers.get("x-forwarded-for", "")
        if forwarded_for:
            first = forwarded_for.split(",")[0].strip()
            if first:
                return first
        real_ip = request_obj.headers.get("x-real-ip", "").strip()
        if real_ip:
            return real_ip

    if request_obj.client and request_obj.client.host:
        return request_obj.client.host
    return "unknown"


def _verify_captcha_token(*, settings: Settings, token: str, client_ip: str) -> None:
    if not settings.signup_captcha_secret_key:
        raise SignupProtectionError(
            "Proteção anti-spam indisponível no momento. Tente novamente em instantes.",
            status_code=503,
        )

    verify_payload = {
        "secret": settings.signup_captcha_secret_key,
        "response": token,
    }
    if client_ip and client_ip != "unknown":
        verify_payload["remoteip"] = client_ip

    form_encoded = parse.urlencode(verify_payload).encode("utf-8")
    verify_request = request.Request(
        url=settings.signup_captcha_verify_endpoint,
        data=form_encoded,
        method="POST",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    ssl_context = ssl.create_default_context(cafile=certifi.where())

    try:
        with request.urlopen(
            verify_request,
            timeout=settings.signup_captcha_timeout_seconds,
            context=ssl_context,
        ) as response:
            payload_raw = response.read().decode("utf-8")
    except error.HTTPError as exc:
        payload_raw = exc.read().decode("utf-8") if exc.fp is not None else ""
        raise SignupProtectionError(
            f"Validação anti-spam falhou no provedor ({exc.code}).",
            status_code=502,
        ) from exc
    except error.URLError as exc:
        raise SignupProtectionError(
            "Não foi possível validar o desafio anti-spam. Tente novamente.",
            status_code=503,
        ) from exc

    try:
        parsed_payload = json.loads(payload_raw) if payload_raw else {}
    except json.JSONDecodeError as exc:
        raise SignupProtectionError(
            "Resposta inválida do provedor de validação anti-spam.",
            status_code=502,
        ) from exc
    if not bool(parsed_payload.get("success")):
        raise SignupProtectionError(
            "Verificação anti-spam inválida. Refaça a validação e tente novamente.",
            status_code=422,
        )

    if settings.signup_captcha_provider == "recaptcha":
        score = parsed_payload.get("score")
        if isinstance(score, (int, float)) and score < settings.signup_captcha_recaptcha_min_score:
            raise SignupProtectionError(
                "A validação anti-spam foi considerada suspeita. Tente novamente.",
                status_code=422,
            )


def enforce_signup_protection(*, settings: Settings, payload: AuthSignupRequest, client_ip: str) -> None:
    if payload.honeypot and payload.honeypot.strip():
        raise SignupProtectionError("Não foi possível processar o cadastro.", status_code=400)

    _signup_rate_limiter.check_and_mark_attempt(
        window_seconds=settings.signup_rate_limit_window_seconds,
        max_attempts_per_ip=settings.signup_rate_limit_max_attempts_per_ip,
        max_attempts_per_email=settings.signup_rate_limit_max_attempts_per_email,
        client_ip=client_ip,
        email=payload.email,
    )

    if settings.signup_captcha_required:
        token = (payload.captcha_token or "").strip()
        if not token:
            raise SignupProtectionError(
                "Confirme que você não é um robô para concluir o cadastro.",
                status_code=422,
            )
        _verify_captcha_token(settings=settings, token=token, client_ip=client_ip)
