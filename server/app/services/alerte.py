"""Alerte service — state machine: ouverte → acquittee → cloturee | expiree.

Alertes are ONLINE-ONLY. Never queue or pretend delivery without server
confirmation (qc-level1.md §5, §9).
"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Alerte, Decision, Produit, Utilisateur
from ..models.enums import StatutAlerte
from ..schemas.alerte import AlerteCreate, AlerteRead, DecisionCreate, DecisionRead
from .sse import broker


def _sse_alerte(alerte: Alerte) -> dict:
    return {
        "id": alerte.id,
        "local_uuid": alerte.local_uuid,
        "suivi_id": alerte.suivi_id,
        "produit_id": alerte.produit_id,
        "num_chariot": alerte.num_chariot,
        "severite": alerte.severite.value,
        "demandeur_id": alerte.demandeur_id,
        "responsable_cible_id": alerte.responsable_cible_id,
        "statut": alerte.statut.value,
        "created_at": alerte.created_at.isoformat(),
    }


def create_alerte(
    db: Session, payload: AlerteCreate, demandeur: Utilisateur
) -> AlerteRead:
    existing = db.execute(
        select(Alerte).where(Alerte.local_uuid == payload.local_uuid)
    ).scalar_one_or_none()
    if existing is not None:
        return _load_alerte(db, existing)

    alerte = Alerte(
        local_uuid=payload.local_uuid,
        suivi_id=payload.suivi_id,
        produit_id=payload.produit_id,
        num_chariot=payload.num_chariot,
        severite=payload.severite,
        demandeur_id=demandeur.id,
        responsable_cible_id=payload.responsable_cible_id,
        statut=StatutAlerte.ouverte,
    )
    db.add(alerte)
    db.commit()
    db.refresh(alerte)

    broker.publish("alerte.created", _sse_alerte(alerte))

    # Best-effort push to the target responsable (online-only, best-effort).
    from . import push as push_svc
    produit = db.get(Produit, alerte.produit_id) if alerte.produit_id else None
    push_svc.notify_user(db, alerte.responsable_cible_id, {
        "type": "alerte.created",
        "alerte_id": alerte.id,
        "num_chariot": alerte.num_chariot,
        "severite": alerte.severite.value,
        "produit_ref": produit.reference if produit else None,
    })

    return _load_alerte(db, alerte)


def _load_alerte(db: Session, alerte: Alerte) -> AlerteRead:
    out = AlerteRead.model_validate(alerte)
    if alerte.decision_id is not None:
        dec = db.get(Decision, alerte.decision_id)
        if dec is not None:
            out.action_text = dec.action_text
            out.resultat_text = dec.resultat_text
    return out


def list_alertes(
    db: Session,
    statut: StatutAlerte | None = None,
    responsable_cible_id: int | None = None,
) -> list[AlerteRead]:
    q = select(Alerte).order_by(Alerte.created_at.desc())
    if statut is not None:
        q = q.where(Alerte.statut == statut)
    if responsable_cible_id is not None:
        q = q.where(Alerte.responsable_cible_id == responsable_cible_id)
    rows = db.execute(q).scalars().all()
    return [_load_alerte(db, r) for r in rows]


def get_alerte(db: Session, alerte_id: int) -> AlerteRead:
    row = db.get(Alerte, alerte_id)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Alerte introuvable")
    return _load_alerte(db, row)


def ack_alerte(db: Session, alerte_id: int, user: Utilisateur) -> AlerteRead:
    alerte = db.get(Alerte, alerte_id)
    if alerte is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Alerte introuvable")
    if alerte.statut != StatutAlerte.ouverte:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Impossible d'acquitter une alerte en statut '{alerte.statut.value}'",
        )
    alerte.statut = StatutAlerte.acquittee
    alerte.acknowledged_at = datetime.now(timezone.utc)
    alerte.acknowledged_by = user.id
    db.commit()
    db.refresh(alerte)

    broker.publish("alerte.acknowledged", {
        "id": alerte.id,
        "acknowledged_at": alerte.acknowledged_at.isoformat(),
        "acknowledged_by": alerte.acknowledged_by,
        "responsable_cible_id": alerte.responsable_cible_id,
    })
    return _load_alerte(db, alerte)


def record_decision(
    db: Session, alerte_id: int, payload: DecisionCreate, user: Utilisateur
) -> DecisionRead:
    alerte = db.get(Alerte, alerte_id)
    if alerte is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Alerte introuvable")
    if alerte.statut not in (StatutAlerte.ouverte, StatutAlerte.acquittee):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Impossible d'enregistrer une décision sur une alerte '{alerte.statut.value}'",
        )

    now = datetime.now(timezone.utc)
    decision = Decision(
        alerte_id=alerte_id,
        suivi_id=alerte.suivi_id,
        responsable_id=user.id,
        action_text=payload.action_text,
        resultat_text=payload.resultat_text,
        decided_at=now,
    )
    db.add(decision)
    db.flush()

    alerte.statut = StatutAlerte.cloturee
    alerte.closed_at = now
    alerte.decision_id = decision.id
    db.commit()
    db.refresh(decision)
    db.refresh(alerte)

    broker.publish("alerte.closed", {
        "id": alerte.id,
        "closed_at": alerte.closed_at.isoformat(),
        "decision_id": alerte.decision_id,
    })
    return DecisionRead.model_validate(decision)


def expire_due(db: Session, timeout_seconds: int) -> int:
    """Mark ouverte alertes older than timeout as expiree. Returns count expired."""
    from sqlalchemy import and_

    cutoff = datetime.now(timezone.utc).timestamp() - timeout_seconds
    rows = db.execute(
        select(Alerte).where(
            and_(
                Alerte.statut == StatutAlerte.ouverte,
                Alerte.created_at <= datetime.fromtimestamp(cutoff, tz=timezone.utc),
            )
        )
    ).scalars().all()

    count = 0
    from . import push as push_svc

    for alerte in rows:
        alerte.statut = StatutAlerte.expiree
        broker.publish("alerte.expired", {
            "id": alerte.id,
            "num_chariot": alerte.num_chariot,
            "responsable_cible_id": alerte.responsable_cible_id,
        })
        # Escalation push to ALL methode users on expiry.
        produit = db.get(Produit, alerte.produit_id) if alerte.produit_id else None
        push_svc.notify_all_methode(db, {
            "type": "alerte.expired",
            "alerte_id": alerte.id,
            "num_chariot": alerte.num_chariot,
            "severite": alerte.severite.value,
            "produit_ref": produit.reference if produit else None,
        })
        count += 1

    if count:
        db.commit()
    return count
