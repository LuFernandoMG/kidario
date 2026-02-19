from functools import lru_cache
import ssl

import certifi
import jwt
from jwt import InvalidTokenError, PyJWKClient
from pydantic import BaseModel

from app.core.config import get_settings

SUPPORTED_JWKS_ALGORITHMS = {"RS256", "ES256", "EDDSA"}


class AuthUser(BaseModel):
    user_id: str
    email: str | None = None
    role: str | None = None


class SupabaseJWTVerifier:
    def __init__(self) -> None:
        settings = get_settings()
        self._audience = settings.supabase_jwt_audience
        self._issuer = settings.jwt_issuer
        self._jwt_secret = settings.supabase_jwt_secret
        self._jwk_client = PyJWKClient(
            settings.jwt_jwks_url,
            ssl_context=self._build_ssl_context(settings.supabase_jwks_ca_bundle),
        )

    @staticmethod
    def _build_ssl_context(ca_bundle_path: str | None) -> ssl.SSLContext:
        # Use explicit CA bundle if configured; otherwise use certifi to avoid
        # local trust-store issues when fetching Supabase JWKS.
        cafile = ca_bundle_path or certifi.where()
        return ssl.create_default_context(cafile=cafile)

    def _decode_with_jwks(self, token: str, algorithm: str) -> dict:
        if algorithm not in SUPPORTED_JWKS_ALGORITHMS:
            raise InvalidTokenError(f"Unsupported JWT algorithm for JWKS verification: {algorithm}")
        signing_key = self._jwk_client.get_signing_key_from_jwt(token)
        return jwt.decode(
            token,
            signing_key.key,
            algorithms=[algorithm],
            audience=self._audience,
            issuer=self._issuer,
        )

    def _decode_with_secret(self, token: str) -> dict:
        if not self._jwt_secret:
            raise InvalidTokenError(
                "Token HS256 detectado, pero KIDARIO_SUPABASE_JWT_SECRET no esta configurado."
            )
        return jwt.decode(
            token,
            self._jwt_secret,
            algorithms=["HS256"],
            audience=self._audience,
            issuer=self._issuer,
        )

    def verify(self, token: str) -> AuthUser:
        header = jwt.get_unverified_header(token)
        algorithm = str(header.get("alg", "")).upper()

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
