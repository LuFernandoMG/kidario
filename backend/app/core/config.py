from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="KIDARIO_", extra="ignore")

    env: str = "development"
    api_v1_prefix: str = "/api/v1"
    cors_origins: str = "http://localhost:5173"

    supabase_url: str
    supabase_anon_key: str | None = None
    supabase_service_role_key: str | None = None
    supabase_jwt_audience: str = "authenticated"
    supabase_jwt_issuer: str | None = None
    supabase_jwt_secret: str | None = None
    supabase_jwks_ca_bundle: str | None = None
    supabase_http_timeout_seconds: float = 15.0
    trust_proxy_headers: bool = True

    signup_rate_limit_window_seconds: int = 300
    signup_rate_limit_max_attempts_per_ip: int = 20
    signup_rate_limit_max_attempts_per_email: int = 8
    signup_captcha_required: bool = False
    signup_captcha_provider: str = "turnstile"
    signup_captcha_secret_key: str | None = None
    signup_captcha_verify_url: str | None = None
    signup_captcha_timeout_seconds: float = 8.0
    signup_captcha_recaptcha_min_score: float = 0.5
    profile_photos_bucket: str = "teacher-profile-photos"
    profile_photo_max_upload_bytes: int = 5_242_880
    profile_photo_signed_url_ttl_seconds: int = 3600
    storage_s3_endpoint_url: str | None = None
    storage_s3_region: str = "us-east-1"
    storage_s3_access_key_id: str | None = None
    storage_s3_secret_access_key: str | None = None

    database_url: str

    admin_emails: str = ""
    teacher_activity_llm_enabled: bool = False
    teacher_activity_llm_api_key: str | None = None
    teacher_activity_llm_model: str = "gpt-4o-mini"
    teacher_activity_llm_base_url: str = "https://api.openai.com/v1"
    teacher_activity_llm_timeout_seconds: float = 8.0
    teacher_activity_llm_ca_bundle: str | None = None

    @field_validator("api_v1_prefix")
    @classmethod
    def ensure_prefix_starts_with_slash(cls, value: str) -> str:
        if not value.startswith("/"):
            return f"/{value}"
        return value

    @field_validator("signup_captcha_provider")
    @classmethod
    def validate_signup_captcha_provider(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in {"turnstile", "recaptcha"}:
            raise ValueError("signup_captcha_provider must be 'turnstile' or 'recaptcha'.")
        return normalized

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def jwt_issuer(self) -> str:
        if self.supabase_jwt_issuer:
            return self.supabase_jwt_issuer
        return f"{self.supabase_url.rstrip('/')}/auth/v1"

    @property
    def jwt_jwks_url(self) -> str:
        return f"{self.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"

    @property
    def admin_email_set(self) -> set[str]:
        return {email.strip().lower() for email in self.admin_emails.split(",") if email.strip()}

    @property
    def signup_captcha_verify_endpoint(self) -> str:
        if self.signup_captcha_verify_url:
            return self.signup_captcha_verify_url.strip()
        if self.signup_captcha_provider == "recaptcha":
            return "https://www.google.com/recaptcha/api/siteverify"
        return "https://challenges.cloudflare.com/turnstile/v0/siteverify"


@lru_cache
def get_settings() -> Settings:
    return Settings()
