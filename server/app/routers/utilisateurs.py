from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import require_roles
from ..models.enums import Role
from ..schemas.utilisateur import UtilisateurCreate, UtilisateurRead, UtilisateurUpdate
from ..services import utilisateur as service

# User management is admin-only across the board (roles, §3).
router = APIRouter(
    prefix="/utilisateurs", tags=["utilisateurs"], dependencies=[Depends(require_roles(Role.admin))]
)


@router.get("", response_model=list[UtilisateurRead])
def list_utilisateurs(db: Session = Depends(get_db)) -> list:
    return service.list_utilisateurs(db)


@router.get("/{user_id}", response_model=UtilisateurRead)
def get_utilisateur(user_id: int, db: Session = Depends(get_db)):
    return service.get_utilisateur(db, user_id)


@router.post("", response_model=UtilisateurRead, status_code=status.HTTP_201_CREATED)
def create_utilisateur(body: UtilisateurCreate, db: Session = Depends(get_db)):
    return service.create_utilisateur(db, body)


@router.patch("/{user_id}", response_model=UtilisateurRead)
def update_utilisateur(user_id: int, body: UtilisateurUpdate, db: Session = Depends(get_db)):
    return service.update_utilisateur(db, user_id, body)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_utilisateur(user_id: int, db: Session = Depends(get_db)) -> None:
    service.delete_utilisateur(db, user_id)
