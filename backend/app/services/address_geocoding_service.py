import json
import logging
from collections.abc import Callable, Mapping
from typing import Any
from urllib import error, parse, request

from app.core.config import Settings
from app.core.ssl_utils import build_ssl_context


logger = logging.getLogger(__name__)

HttpJsonGet = Callable[[str, float, str | None], Mapping[str, Any] | None]


def _clean_text(value: object) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _digits(value: object) -> str:
    if value is None:
        return ""
    return "".join(ch for ch in str(value) if ch.isdigit())


def _normalized_postal_code(value: object) -> str | None:
    digits = _digits(value)
    return digits if len(digits) == 8 else None


def _http_json_get(url: str, timeout_seconds: float, ca_bundle_path: str | None) -> Mapping[str, Any] | None:
    req = request.Request(url=url, method="GET", headers={"Accept": "application/json"})
    ssl_context = build_ssl_context(ca_bundle_path)
    try:
        with request.urlopen(req, timeout=timeout_seconds, context=ssl_context) as response:
            payload_raw = response.read().decode("utf-8")
    except (error.HTTPError, error.URLError, TimeoutError, OSError) as exc:
        logger.info("Address enrichment request failed: %s", exc)
        return None

    try:
        payload = json.loads(payload_raw) if payload_raw else {}
    except json.JSONDecodeError:
        logger.info("Address enrichment response was not valid JSON.")
        return None
    return payload if isinstance(payload, Mapping) else None


def _fetch_viacep_address(
    settings: Settings,
    postal_code: str,
    *,
    http_json_get: HttpJsonGet = _http_json_get,
) -> dict[str, Any]:
    url = f"{settings.viacep_base_url.rstrip('/')}/{postal_code}/json/"
    payload = http_json_get(url, settings.viacep_timeout_seconds, settings.viacep_ca_bundle)
    if not payload or payload.get("erro") is True:
        return {}

    return {
        "street": _clean_text(payload.get("logradouro")),
        "district": _clean_text(payload.get("bairro")),
        "city": _clean_text(payload.get("localidade")),
        "state": _clean_text(payload.get("uf")),
        "postal_code": _normalized_postal_code(payload.get("cep")) or postal_code,
        "country": "BR",
    }


def _build_google_address(values: Mapping[str, Any]) -> str:
    street_line = " ".join(
        part
        for part in [
            _clean_text(values.get("street")),
            _clean_text(values.get("number")),
        ]
        if part
    )
    locality = ", ".join(
        part
        for part in [
            _clean_text(values.get("district")),
            _clean_text(values.get("city")),
            _clean_text(values.get("state")),
        ]
        if part
    )
    return ", ".join(
        part
        for part in [
            street_line or None,
            locality or None,
            _clean_text(values.get("postal_code")),
            "Brasil" if (values.get("country") or "BR") == "BR" else _clean_text(values.get("country")),
        ]
        if part
    )


def _fetch_google_coordinates(
    settings: Settings,
    values: Mapping[str, Any],
    *,
    http_json_get: HttpJsonGet = _http_json_get,
) -> tuple[float, float] | None:
    api_key = (settings.google_geocoding_api_key or "").strip()
    if not api_key:
        return None

    address = _build_google_address(values)
    if not address:
        return None

    query: dict[str, str] = {
        "address": address,
        "key": api_key,
        "language": "pt-BR",
        "region": "br",
    }
    postal_code = _normalized_postal_code(values.get("postal_code"))
    components = ["country:BR"]
    if postal_code:
        components.append(f"postal_code:{postal_code}")
    query["components"] = "|".join(components)

    url = f"{settings.google_geocoding_base_url}?{parse.urlencode(query)}"
    payload = http_json_get(url, settings.google_geocoding_timeout_seconds, settings.google_geocoding_ca_bundle)
    if not payload or payload.get("status") != "OK":
        return None

    results = payload.get("results")
    if not isinstance(results, list) or not results:
        return None
    location = ((results[0] or {}).get("geometry") or {}).get("location") or {}
    lat = location.get("lat")
    lng = location.get("lng")
    if not isinstance(lat, (int, float)) or not isinstance(lng, (int, float)):
        return None
    return float(lat), float(lng)


def enrich_address_coordinates(
    settings: Settings,
    values: Mapping[str, Any],
    *,
    http_json_get: HttpJsonGet = _http_json_get,
) -> dict[str, Any]:
    enriched = dict(values)
    postal_code = _normalized_postal_code(enriched.get("postal_code"))
    if postal_code:
        enriched["postal_code"] = postal_code

    if not settings.google_geocoding_enabled:
        return enriched

    viacep_values = _fetch_viacep_address(settings, postal_code, http_json_get=http_json_get) if postal_code else {}
    geocode_values = dict(enriched)
    for field, value in viacep_values.items():
        if not value:
            continue
        geocode_values[field] = value
        if not enriched.get(field):
            enriched[field] = value

    coordinates = _fetch_google_coordinates(settings, geocode_values, http_json_get=http_json_get)
    if coordinates:
        enriched["latitude"], enriched["longitude"] = coordinates
    return enriched
