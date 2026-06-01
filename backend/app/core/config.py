from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="KIDARIO_", extra="ignore")

    env: str = "development"
    api_v2_prefix: str = "/api/v2"
    cors_origins: str = "http://localhost:5173"
    public_site_url: str = "https://use.kidario.app"

    supabase_url: str
    supabase_anon_key: str | None = None
    supabase_service_role_key: str | None = None
    supabase_jwt_audience: str = "authenticated"
    supabase_jwt_issuer: str | None = None
    supabase_jwt_secret: str | None = None
    supabase_jwt_leeway_seconds: int = 60
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
    profile_photo_target_size_pixels: int = 512
    profile_photo_jpeg_quality: int = 82
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

    google_geocoding_api_key: str | None = None
    google_geocoding_base_url: str = "https://maps.googleapis.com/maps/api/geocode/json"
    google_geocoding_timeout_seconds: float = 5.0
    google_geocoding_ca_bundle: str | None = None
    viacep_base_url: str = "https://viacep.com.br/ws"
    viacep_timeout_seconds: float = 4.0
    viacep_ca_bundle: str | None = None

    pagarme_secret_key: str | None = None
    pagarme_base_url: str = "https://api.pagar.me/core/v5"
    pagarme_webhook_secret: str | None = None
    pagarme_platform_recipient_id: str | None = None
    pagarme_timeout_seconds: float = 15.0
    pagarme_ca_bundle: str | None = None
    platform_fee_percent: float = 20.0
    parent_service_fee_percent: float = 8.0

    @field_validator("api_v2_prefix")
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

    @field_validator("supabase_jwt_leeway_seconds")
    @classmethod
    def validate_supabase_jwt_leeway_seconds(cls, value: int) -> int:
        return max(0, value)

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

    @property
    def pagarme_enabled(self) -> bool:
        return bool(self.pagarme_secret_key)

    @property
    def google_geocoding_enabled(self) -> bool:
        return bool(self.google_geocoding_api_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()
