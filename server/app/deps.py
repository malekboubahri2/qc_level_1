"""Request dependencies: bearer auth + role guard."""
from __future__ import annotations

from collections.abc import Callable

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .db import get_db
from .models import Utilisateur
from .models.enums import Role
from .security import ACCESS, decode_token

_bearer = HTTPBearer(auto_error=False)
_UNAUTH = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Authentification requise",
    headers={"WWW-Authenticate": "Bearer"},
)


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> Utilisateur:
    if creds is None:
        raise _UNAUTH
    try:
        payload = decode_token(creds.credentials)
    except jwt.PyJWTError as exc:
        raise _UNAUTH from exc
    if payload.get("type") != ACCESS:
        raise _UNAUTH
    user = db.get(Utilisateur, int(payload["sub"]))
    if user is None or not user.actif:
        raise _UNAUTH
    return user


def require_roles(*roles: Role) -> Callable[..., Utilisateur]:
    allowed = {r.value for r in roles}

    def _checker(user: Utilisateur = Depends(get_current_user)) -> Utilisateur:
        if user.role.value not in allowed:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès refusé")
        return user

    return _checker
