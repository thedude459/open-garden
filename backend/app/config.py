import warnings

from pydantic_settings import BaseSettings, SettingsConfigDict

_INSECURE_KEYS = {"change-me", "replace-with-long-random-string"}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "open-garden-api"
    env: str = "development"  # Set to "production" to enforce strict security checks.
    secret_key: str = "change-me"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24

    database_url: str = "postgresql+psycopg2://opengarden:opengarden@db:5432/opengarden"
    weather_base_url: str = "https://api.open-meteo.com/v1/forecast"
    allowed_origins: list[str] = [
        "http://localhost:5173",
        "http://localhost:4173",
    ]
    frontend_base_url: str = "http://localhost:5173"
    email_verification_expire_minutes: int = 60
    password_reset_expire_minutes: int = 30
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from_email: str = "noreply@open-garden.local"
    smtp_use_tls: bool = True

    # Basic in-app abuse controls. These are per-process limits and should be
    # complemented by edge/CDN WAF + rate limits in production.
    global_rate_limit_per_minute: int = 180
    auth_login_limit_per_minute: int = 5
    auth_register_limit_per_minute: int = 5
    auth_verify_limit_per_minute: int = 20
    auth_reset_limit_per_minute: int = 10
    auth_forgot_limit_per_hour: int = 8
    auth_resend_limit_per_hour: int = 12


settings = Settings()

if settings.secret_key in _INSECURE_KEYS:
    if settings.env == "production":
        raise RuntimeError(
            "SECRET_KEY is set to an insecure default value. "
            "Set SECRET_KEY to a long random string in .env before deploying."
        )
    warnings.warn(
        "SECRET_KEY is set to an insecure default value. "
        "Set SECRET_KEY to a long random string in .env before deploying.",
        stacklevel=1,
    )
