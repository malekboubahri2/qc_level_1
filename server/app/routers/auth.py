from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import get_current_user
from ..models import Utilisateur
from ..schemas.auth import LoginRequest, MeResponse, RefreshRequest, TokenResponse
from ..services import auth as auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = auth_service.authenticate(db, body.nom, body.secret)
    return auth_service.tokens_for(user)


@router.post("/refresh", response_model=TokenResponse)
def refresh(body: RefreshRequest, db: Session = Depends(get_db)) -> TokenResponse:
    return auth_service.refresh(db, body.refresh_token)


@router.get("/me", response_model=MeResponse)
def me(user: Utilisateur = Depends(get_current_user)) -> Utilisateur:
    return user
