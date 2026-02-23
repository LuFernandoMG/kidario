import importlib
from functools import lru_cache
import ssl

import certifi
from pydantic import BaseModel

from app.core.config import get_settings

SUPPORTED_JWKS_ALGORITHMS = {"RS256", "ES256", "EDDSA"}


class AuthUser(BaseModel):
    user_id: str
    email: str | None = None
    role: str | None = None


class InvalidTokenError(Exception):
    pass


@lru_cache
def _get_pyjwt_module():
    return importlib.import_module("jwt")


class SupabaseJWTVerifier:
    def __init__(self) -> None:
        settings = get_settings()
        self._audience = settings.supabase_jwt_audience
        self._issuer = settings.jwt_issuer
        self._jwt_secret = settings.supabase_jwt_secret
        self._jwks_url = settings.jwt_jwks_url
        self._ssl_context = self._build_ssl_context(settings.supabase_jwks_ca_bundle)
        self._jwk_client = None

    @staticmethod
    def _build_ssl_context(ca_bundle_path: str | None) -> ssl.SSLContext:
        # Use explicit CA bundle if configured; otherwise use certifi to avoid
        # local trust-store issues when fetching Supabase JWKS.
        cafile = ca_bundle_path or certifi.where()
        return ssl.create_default_context(cafile=cafile)

    def _get_jwk_client(self):
        if self._jwk_client is None:
            jwt_module = _get_pyjwt_module()
            pyjwk_client_class = getattr(jwt_module, "PyJWKClient")
            self._jwk_client = pyjwk_client_class(
                self._jwks_url,
                ssl_context=self._ssl_context,
            )
        return self._jwk_client

    def _decode_with_jwks(self, token: str, algorithm: str) -> dict:
        if algorithm not in SUPPORTED_JWKS_ALGORITHMS:
            raise InvalidTokenError(f"Unsupported JWT algorithm for JWKS verification: {algorithm}")

        jwt_module = _get_pyjwt_module()
        pyjwt_invalid = getattr(jwt_module, "InvalidTokenError", Exception)
        try:
            signing_key = self._get_jwk_client().get_signing_key_from_jwt(token)
            return jwt_module.decode(
                token,
                signing_key.key,
                algorithms=[algorithm],
                audience=self._audience,
                issuer=self._issuer,
            )
        except Exception as exc:
            if isinstance(exc, pyjwt_invalid):
                raise InvalidTokenError(str(exc)) from exc
            raise

    def _decode_with_secret(self, token: str) -> dict:
        if not self._jwt_secret:
            raise InvalidTokenError(
                "Token HS256 detectado, pero KIDARIO_SUPABASE_JWT_SECRET no esta configurado."
            )

        jwt_module = _get_pyjwt_module()
        pyjwt_invalid = getattr(jwt_module, "InvalidTokenError", Exception)
        try:
            return jwt_module.decode(
                token,
                self._jwt_secret,
                algorithms=["HS256"],
                audience=self._audience,
                issuer=self._issuer,
            )
        except Exception as exc:
            if isinstance(exc, pyjwt_invalid):
                raise InvalidTokenError(str(exc)) from exc
            raise

    def verify(self, token: str) -> AuthUser:
        jwt_module = _get_pyjwt_module()
        pyjwt_invalid = getattr(jwt_module, "InvalidTokenError", Exception)

        try:
            header = jwt_module.get_unverified_header(token)
            algorithm = str(header.get("alg", "")).upper()
        except Exception as exc:
            if isinstance(exc, pyjwt_invalid):
                raise InvalidTokenError(str(exc)) from exc
            raise

        if algorithm == "HS256":
            payload = self._decode_with_secret(token)
        else:
            payload = self._decode_with_jwks(token, algorithm)

        return AuthUser(
            user_id=str(payload.get("sub")),
            email=payload.get("email"),
            role=payload.get("role"),
        )


@lru_cache
def get_jwt_verifier() -> SupabaseJWTVerifier:
    return SupabaseJWTVerifier()


__all__ = ["AuthUser", "InvalidTokenError", "get_jwt_verifier"]
