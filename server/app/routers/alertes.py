"""Alerte routes: create, list, get, ack, decision.

Alertes are ONLINE-ONLY — never accept queued/offline submissions.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import get_current_user, require_roles
from ..models import Utilisateur
from ..models.enums import Role, StatutAlerte
from ..schemas.alerte import AlerteCreate, AlerteRead, DecisionCreate, DecisionRead
from ..services import alerte as svc

router = APIRouter(prefix="/alertes", tags=["alertes"])


@router.post("", response_model=AlerteRead, status_code=201)
def create_alerte(
    payload: AlerteCreate,
    db: Session = Depends(get_db),
    user: Utilisateur = Depends(require_roles(Role.inspecteur, Role.admin)),
) -> AlerteRead:
    return svc.create_alerte(db, payload, user)


@router.get("", response_model=list[AlerteRead])
def list_alertes(
    statut: StatutAlerte | None = Query(None),
    db: Session = Depends(get_db),
    _: Utilisateur = Depends(get_current_user),
) -> list[AlerteRead]:
    return svc.list_alertes(db, statut)


@router.get("/{alerte_id}", response_model=AlerteRead)
def get_alerte(
    alerte_id: int,
    db: Session = Depends(get_db),
    _: Utilisateur = Depends(get_current_user),
) -> AlerteRead:
    return svc.get_alerte(db, alerte_id)


@router.patch("/{alerte_id}/ack", response_model=AlerteRead)
def ack_alerte(
    alerte_id: int,
    db: Session = Depends(get_db),
    user: Utilisateur = Depends(require_roles(Role.methode, Role.admin)),
) -> AlerteRead:
    return svc.ack_alerte(db, alerte_id, user)


@router.post("/{alerte_id}/decision", response_model=DecisionRead, status_code=201)
def record_decision(
    alerte_id: int,
    payload: DecisionCreate,
    db: Session = Depends(get_db),
    user: Utilisateur = Depends(require_roles(Role.methode, Role.admin)),
) -> DecisionRead:
    return svc.record_decision(db, alerte_id, payload, user)
