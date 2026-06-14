from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Client, Produit
from ..schemas.produit import ProduitCreate, ProduitUpdate


def list_produits(db: Session) -> list[Produit]:
    return list(db.execute(select(Produit).order_by(Produit.reference)).scalars())


def get_produit(db: Session, produit_id: int) -> Produit:
    produit = db.get(Produit, produit_id)
    if produit is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Produit introuvable")
    return produit


def _ref_taken(db: Session, reference: str, exclude_id: int | None = None) -> bool:
    stmt = select(Produit.id).where(Produit.reference == reference)
    if exclude_id is not None:
        stmt = stmt.where(Produit.id != exclude_id)
    return db.execute(stmt).first() is not None


def _check_client(db: Session, client_id: int | None) -> None:
    if client_id is not None and db.get(Client, client_id) is None:
        raise HTTPException(422, "Client inconnu")


def create_produit(db: Session, data: ProduitCreate) -> Produit:
    if _ref_taken(db, data.reference):
        raise HTTPException(status.HTTP_409_CONFLICT, "Référence déjà utilisée")
    _check_client(db, data.client_id)
    produit = Produit(**data.model_dump())
    db.add(produit)
    db.commit()
    db.refresh(produit)
    return produit


def update_produit(db: Session, produit_id: int, data: ProduitUpdate) -> Produit:
    produit = get_produit(db, produit_id)
    fields = data.model_dump(exclude_unset=True)
    if "reference" in fields and _ref_taken(db, fields["reference"], exclude_id=produit_id):
        raise HTTPException(status.HTTP_409_CONFLICT, "Référence déjà utilisée")
    if "client_id" in fields:
        _check_client(db, fields["client_id"])
    for key, value in fields.items():
        setattr(produit, key, value)
    db.commit()
    db.refresh(produit)
    return produit


def delete_produit(db: Session, produit_id: int) -> None:
    produit = get_produit(db, produit_id)
    db.delete(produit)
    db.commit()
