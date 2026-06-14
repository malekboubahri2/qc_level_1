"""Application settings — environment-driven, never hardcoded in source.

All knobs come from `QC_`-prefixed environment variables (or a local `.env`),
so a new environment is a config change, not a code change (principles §2).
"""
from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="QC_", env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # ── Persistence ────────────────────────────────────────────────────────
    # SQLite (WAL) for the PoC; swap to Postgres via an ADR + a URL change.
    database_url: str = "sqlite:///./qc_level1.db"

    # ── Auth (JWT + argon2) ────────────────────────────────────────────────
    # MUST be overridden in any real deployment (QC_SECRET_KEY). ≥32 bytes so
    # HS256 is happy even with the placeholder.
    secret_key: str = "dev-insecure-change-me-0123456789-abcdef"
    jwt_algorithm: str = "HS256"
    access_token_ttl_min: int = 30
    refresh_token_ttl_days: int = 7

    # ── Domain settings (used from Phase 1 onward) ─────────────────────────
    alerte_timeout_seconds: int = 120

    # ── Presentation ───────────────────────────────────────────────────────
    default_locale: str = "fr-TN"

    # Comma-separated; same-origin in prod (Caddy), explicit for `pnpm dev`.
    cors_origins: str = "http://localhost:5173,https://localhost"

    # ── Seed (dev convenience; override the secret via env in prod) ────────
    admin_nom: str = "admin"
    admin_secret: str = "admin"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")


settings = Settings()
