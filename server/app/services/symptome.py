from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import SymptomeCatalogue
from ..schemas.symptome import SymptomeCreate, SymptomeUpdate


def list_symptomes(db: Session) -> list[SymptomeCatalogue]:
    stmt = select(SymptomeCatalogue).order_by(
        SymptomeCatalogue.ordre, SymptomeCatalogue.code
    )
    return list(db.execute(stmt).scalars())


def get_symptome(db: Session, symptome_id: int) -> SymptomeCatalogue:
    symptome = db.get(SymptomeCatalogue, symptome_id)
    if symptome is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Symptôme introuvable")
    return symptome


def _code_taken(db: Session, code: str, exclude_id: int | None = None) -> bool:
    stmt = select(SymptomeCatalogue.id).where(SymptomeCatalogue.code == code)
    if exclude_id is not None:
        stmt = stmt.where(SymptomeCatalogue.id != exclude_id)
    return db.execute(stmt).first() is not None


def create_symptome(db: Session, data: SymptomeCreate) -> SymptomeCatalogue:
    if _code_taken(db, data.code):
        raise HTTPException(status.HTTP_409_CONFLICT, "Code symptôme déjà utilisé")
    symptome = SymptomeCatalogue(**data.model_dump())
    db.add(symptome)
    db.commit()
    db.refresh(symptome)
    return symptome


def update_symptome(
    db: Session, symptome_id: int, data: SymptomeUpdate
) -> SymptomeCatalogue:
    symptome = get_symptome(db, symptome_id)
    fields = data.model_dump(exclude_unset=True)
    if "code" in fields and _code_taken(db, fields["code"], exclude_id=symptome_id):
        raise HTTPException(status.HTTP_409_CONFLICT, "Code symptôme déjà utilisé")
    for key, value in fields.items():
        setattr(symptome, key, value)
    db.commit()
    db.refresh(symptome)
    return symptome


def delete_symptome(db: Session, symptome_id: int) -> None:
    symptome = get_symptome(db, symptome_id)
    db.delete(symptome)
    db.commit()
