"""Secret hashing (argon2) + JWT issuance/verification."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import Argon2Error, VerifyMismatchError

from .config import settings

_hasher = PasswordHasher()

ACCESS = "access"
REFRESH = "refresh"


# ── argon2 ─────────────────────────────────────────────────────────────────
def hash_secret(secret: str) -> str:
    return _hasher.hash(secret)


def verify_secret(secret: str, hashed: str) -> bool:
    try:
        return _hasher.verify(hashed, secret)
    except (VerifyMismatchError, Argon2Error):
        return False


# ── JWT ────────────────────────────────────────────────────────────────────
def _encode(sub: int, role: str, token_type: str, ttl: timedelta) -> str:
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": str(sub),
        "role": role,
        "type": token_type,
        "iat": now,
        "exp": now + ttl,
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


def create_access_token(user_id: int, role: str) -> str:
    return _encode(
        user_id, role, ACCESS, timedelta(minutes=settings.access_token_ttl_min)
    )


def create_refresh_token(user_id: int, role: str) -> str:
    return _encode(
        user_id, role, REFRESH, timedelta(days=settings.refresh_token_ttl_days)
    )


def decode_token(token: str) -> dict[str, Any]:
    """Raises jwt.PyJWTError on any invalid/expired token — caller maps to 401."""
    return jwt.decode(
        token, settings.secret_key, algorithms=[settings.jwt_algorithm]
    )
