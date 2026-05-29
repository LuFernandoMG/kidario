from urllib import parse

from app.core.config import Settings
from app.services.address_geocoding_service import enrich_address_coordinates


def _settings(**overrides) -> Settings:
    values = {
        "supabase_url": "https://example.supabase.co",
        "database_url": "postgresql+psycopg://postgres:postgres@localhost:5432/postgres",
        "google_geocoding_api_key": "google-key",
    }
    values.update(overrides)
    return Settings(**values)


def test_enrich_address_coordinates_uses_viacep_then_google() -> None:
    calls: list[str] = []

    def _fake_http_json_get(url: str, timeout_seconds: float, ca_bundle_path: str | None):
        calls.append(url)
        if "viacep.com.br" in url:
            return {
                "cep": "01001-000",
                "logradouro": "Praca da Se",
                "bairro": "Se",
                "localidade": "Sao Paulo",
                "uf": "SP",
            }
        parsed = parse.urlparse(url)
        query = parse.parse_qs(parsed.query)
        assert query["key"] == ["google-key"]
        assert query["language"] == ["pt-BR"]
        assert query["region"] == ["br"]
        assert query["components"] == ["country:BR|postal_code:01001000"]
        assert "Praca da Se" in query["address"][0]
        return {
            "status": "OK",
            "results": [
                {
                    "geometry": {
                        "location": {
                            "lat": -23.55052,
                            "lng": -46.633308,
                        }
                    }
                }
            ],
        }

    result = enrich_address_coordinates(
        _settings(),
        {
            "street": None,
            "number": "100",
            "district": None,
            "city": None,
            "state": None,
            "postal_code": "01001-000",
            "country": "BR",
            "latitude": None,
            "longitude": None,
        },
        http_json_get=_fake_http_json_get,
    )

    assert len(calls) == 2
    assert result["street"] == "Praca da Se"
    assert result["district"] == "Se"
    assert result["city"] == "Sao Paulo"
    assert result["state"] == "SP"
    assert result["postal_code"] == "01001000"
    assert result["latitude"] == -23.55052
    assert result["longitude"] == -46.633308


def test_enrich_address_coordinates_does_not_call_external_services_without_google_key() -> None:
    def _fake_http_json_get(url: str, timeout_seconds: float, ca_bundle_path: str | None):
        raise AssertionError("external service should not be called")

    result = enrich_address_coordinates(
        _settings(google_geocoding_api_key=None),
        {
            "street": "Rua A",
            "number": "123",
            "district": "Centro",
            "city": "Sao Paulo",
            "state": "SP",
            "postal_code": "01001-000",
            "country": "BR",
            "latitude": None,
            "longitude": None,
        },
        http_json_get=_fake_http_json_get,
    )

    assert result["postal_code"] == "01001000"
    assert result["latitude"] is None
    assert result["longitude"] is None
