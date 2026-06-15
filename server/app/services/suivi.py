"""Suivi service — offline-first, idempotent by local_uuid."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..models import SuiviQualiteProd, SuiviSymptome, Utilisateur, Visa
from ..models.alerte import Alerte, Decision
from ..models.client import Client
from ..models.produit import Produit
from ..models.enums import TypeVisa
from ..schemas.suivi import SuiviCreate, SuiviRead, VisaRead


def _build_lookup(db: Session, suivi_ids: list[int]) -> dict[int, dict]:
    """One query: pull client_nom, produit_reference/libelle, action_methode for all rows."""
    if not suivi_ids:
        return {}

    # Client and produit names via JOIN
    name_rows = db.execute(
        select(
            SuiviQualiteProd.id,
            Client.nom.label("client_nom"),
            Produit.reference.label("produit_reference"),
            Produit.libelle.label("produit_libelle"),
        )
        .join(Client, Client.id == SuiviQualiteProd.client_id)
        .join(Produit, Produit.id == SuiviQualiteProd.produit_id)
        .where(SuiviQualiteProd.id.in_(suivi_ids))
    ).all()

    lookup: dict[int, dict] = {
        r.id: {
            "client_nom": r.client_nom,
            "produit_reference": r.produit_reference,
            "produit_libelle": r.produit_libelle,
            "action_methode": None,
        }
        for r in name_rows
    }

    # Decision action per suivi (first recorded)
    dec_rows = db.execute(
        select(Alerte.suivi_id, Decision.action_text)
        .join(Decision, Decision.alerte_id == Alerte.id)
        .where(Alerte.suivi_id.in_(suivi_ids))
        .order_by(Alerte.suivi_id, Decision.id.asc())
    ).all()
    seen: set[int] = set()
    for r in dec_rows:
        if r.suivi_id not in seen:
            seen.add(r.suivi_id)
            if r.suivi_id in lookup:
                lookup[r.suivi_id]["action_methode"] = r.action_text

    return lookup


def _load(db: Session, suivi: SuiviQualiteProd, extra: dict | None = None) -> SuiviRead:
    out = SuiviRead.model_validate(suivi)
    if extra:
        out.client_nom = extra.get("client_nom")
        out.produit_reference = extra.get("produit_reference")
        out.produit_libelle = extra.get("produit_libelle")
        out.action_methode = extra.get("action_methode")
    else:
        # Single-row fallback (used on create/get)
        lk = _build_lookup(db, [suivi.id])
        e = lk.get(suivi.id, {})
        out.client_nom = e.get("client_nom")
        out.produit_reference = e.get("produit_reference")
        out.produit_libelle = e.get("produit_libelle")
        out.action_methode = e.get("action_methode")
    return out


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
        return _load(db, existing)

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
    return _load(db, suivi)


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
    rows = db.execute(stmt).scalars().all()
    lookup = _build_lookup(db, [r.id for r in rows])
    return [_load(db, r, lookup.get(r.id)) for r in rows]


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
    return _load(db, row)


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
