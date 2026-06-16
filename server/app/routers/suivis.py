"""Suivi routes: POST (single), POST /sync (batch), GET list, GET by id, POST visa."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import get_current_user, require_roles
from ..models import Utilisateur
from ..models.enums import Role, TypeVisa
from ..schemas.suivi import SuiviCreate, SuiviRead, SuiviSyncBatch, VisaCreate, VisaRead
from ..services import suivi as svc

router = APIRouter(prefix="/suivis", tags=["suivis"])


@router.post("", response_model=SuiviRead, status_code=201)
def create_suivi(
    payload: SuiviCreate,
    db: Session = Depends(get_db),
    user: Utilisateur = Depends(require_roles(Role.inspecteur, Role.admin)),
) -> SuiviRead:
    return svc.create_suivi(db, payload, user)


@router.post("/sync", response_model=list[SuiviRead])
def sync_suivis(
    body: SuiviSyncBatch,
    db: Session = Depends(get_db),
    user: Utilisateur = Depends(require_roles(Role.inspecteur, Role.admin)),
) -> list[SuiviRead]:
    return svc.sync_suivis(db, body.items, user)


@router.get("", response_model=list[SuiviRead])
def list_suivis(
    db: Session = Depends(get_db),
    _: Utilisateur = Depends(get_current_user),
    inspecteur_id: int | None = None,
    date: str | None = None,
) -> list[SuiviRead]:
    return svc.list_suivis(db, inspecteur_id=inspecteur_id, date=date)


@router.get("/{suivi_id}", response_model=SuiviRead)
def get_suivi(
    suivi_id: int,
    db: Session = Depends(get_db),
    _: Utilisateur = Depends(get_current_user),
) -> SuiviRead:
    return svc.get_suivi(db, suivi_id)


@router.post("/{suivi_id}/visa", response_model=VisaRead, status_code=201)
def sign_visa(
    suivi_id: int,
    body: VisaCreate,
    db: Session = Depends(get_db),
    user: Utilisateur = Depends(require_roles(Role.methode, Role.qualite, Role.prod, Role.admin)),
) -> VisaRead:
    return svc.sign_visa(db, suivi_id, body.type, user)
