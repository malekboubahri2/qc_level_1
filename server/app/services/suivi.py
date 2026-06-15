"""Suivi service — offline-first, idempotent by local_uuid."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..models import SuiviQualiteProd, SuiviSymptome, Utilisateur, Visa
from ..models.enums import TypeVisa
from ..schemas.suivi import SuiviCreate, SuiviRead, VisaRead


def _load(suivi: SuiviQualiteProd) -> SuiviRead:
    return SuiviRead.model_validate(suivi)


def _attach_symptomes(
    db: Session, suivi: SuiviQualiteProd, symptomes_in: list
) -> None:
    for s in symptomes_in:
        db.add(
            SuiviSymptome(
                suivi_id=suivi.id,
                symptome_id=s.symptome_id,
                present=s.present,
                note=s.note,
            )
        )


def create_suivi(
    db: Session, payload: SuiviCreate, inspecteur: Utilisateur
) -> SuiviRead:
    existing = db.execute(
        select(SuiviQualiteProd).where(
            SuiviQualiteProd.local_uuid == payload.local_uuid
        )
    ).scalar_one_or_none()
    if existing is not None:
        db.refresh(existing, ["symptomes", "visas"])
        return _load(existing)

    suivi = SuiviQualiteProd(
        local_uuid=payload.local_uuid,
        date=payload.date,
        heure=payload.heure,
        num_chariot=payload.num_chariot,
        num_porte_objet=payload.num_porte_objet,
        client_id=payload.client_id,
        produit_id=payload.produit_id,
        resultat=payload.resultat,
        commentaire_decision=payload.commentaire_decision,
        inspecteur_id=inspecteur.id,
    )
    db.add(suivi)
    db.flush()  # get suivi.id before attaching children
    _attach_symptomes(db, suivi, payload.symptomes)
    db.commit()
    db.refresh(suivi, ["symptomes", "visas"])
    return _load(suivi)


def sync_suivis(
    db: Session, items: list[SuiviCreate], inspecteur: Utilisateur
) -> list[SuiviRead]:
    """Batch upsert by local_uuid — idempotent; existing rows are returned as-is."""
    result = []
    for payload in items:
        result.append(create_suivi(db, payload, inspecteur))
    return result


def list_suivis(db: Session, inspecteur_id: int | None = None) -> list[SuiviRead]:
    stmt = (
        select(SuiviQualiteProd)
        .options(
            selectinload(SuiviQualiteProd.symptomes),
            selectinload(SuiviQualiteProd.visas),
        )
        .order_by(SuiviQualiteProd.id.desc())
    )
    if inspecteur_id is not None:
        stmt = stmt.where(SuiviQualiteProd.inspecteur_id == inspecteur_id)
    return [_load(r) for r in db.execute(stmt).scalars().all()]


def get_suivi(db: Session, suivi_id: int) -> SuiviRead:
    row = db.execute(
        select(SuiviQualiteProd)
        .options(
            selectinload(SuiviQualiteProd.symptomes),
            selectinload(SuiviQualiteProd.visas),
        )
        .where(SuiviQualiteProd.id == suivi_id)
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Suivi introuvable")
    return _load(row)


def sign_visa(
    db: Session, suivi_id: int, visa_type: TypeVisa, user: Utilisateur
) -> VisaRead:
    row = db.get(SuiviQualiteProd, suivi_id)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Suivi introuvable")
    visa = Visa(
        suivi_id=suivi_id,
        type=visa_type,
        utilisateur_id=user.id,
        signed_at=datetime.now(timezone.utc),
    )
    db.add(visa)
    db.commit()
    db.refresh(visa)
    return VisaRead.model_validate(visa)
