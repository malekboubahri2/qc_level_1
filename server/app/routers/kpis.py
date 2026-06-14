"""KPI endpoints — taux-nc, précurseurs Pareto, temps-réponse."""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import get_current_user
from ..models import Utilisateur
from ..services import kpi as svc

router = APIRouter(prefix="/kpis", tags=["kpis"])


def _depuis(depuis: Optional[str]) -> Optional[datetime]:
    if not depuis:
        return None
    return datetime.fromisoformat(depuis)


@router.get("/taux-nc")
def get_taux_nc(
    depuis: Optional[str] = Query(None, description="ISO date YYYY-MM-DD"),
    client_id: Optional[int] = Query(None),
    produit_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    _: Utilisateur = Depends(get_current_user),
) -> list[dict]:
    return svc.taux_nc(db, _depuis(depuis), client_id, produit_id)


@router.get("/precurseurs")
def get_precurseurs(
    depuis: Optional[str] = Query(None, description="ISO date YYYY-MM-DD"),
    produit_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    _: Utilisateur = Depends(get_current_user),
) -> list[dict]:
    return svc.precurseurs(db, _depuis(depuis), produit_id)


@router.get("/temps-reponse")
def get_temps_reponse(
    depuis: Optional[str] = Query(None, description="ISO datetime"),
    db: Session = Depends(get_db),
    _: Utilisateur = Depends(get_current_user),
) -> list[dict]:
    return svc.temps_reponse(db, _depuis(depuis))
