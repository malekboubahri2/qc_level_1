from __future__ import annotations

import jwt
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Utilisateur
from ..schemas.auth import TokenResponse
from ..security import (
    REFRESH,
    create_access_token,
    create_refresh_token,
    decode_token,
    verify_secret,
)

_INVALID = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED, detail="Identifiants invalides"
)


def authenticate(db: Session, nom: str, secret: str) -> Utilisateur:
    user = db.execute(
        select(Utilisateur).where(Utilisateur.nom == nom)
    ).scalar_one_or_none()
    if user is None or not user.actif or not verify_secret(secret, user.secret_hash):
        raise _INVALID
    return user


def tokens_for(user: Utilisateur) -> TokenResponse:
    return TokenResponse(
        access_token=create_access_token(user.id, user.role.value),
        refresh_token=create_refresh_token(user.id, user.role.value),
    )


def refresh(db: Session, refresh_token: str) -> TokenResponse:
    try:
        payload = decode_token(refresh_token)
    except jwt.PyJWTError as exc:
        raise _INVALID from exc
    if payload.get("type") != REFRESH:
        raise _INVALID
    user = db.get(Utilisateur, int(payload["sub"]))
    if user is None or not user.actif:
        raise _INVALID
    return tokens_for(user)
