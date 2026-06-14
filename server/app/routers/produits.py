from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import get_current_user, require_roles
from ..models.enums import Role
from ..schemas.produit import ProduitCreate, ProduitRead, ProduitUpdate
from ..services import produit as service

router = APIRouter(prefix="/produits", tags=["produits"])
_admin = require_roles(Role.admin)


@router.get("", response_model=list[ProduitRead], dependencies=[Depends(get_current_user)])
def list_produits(db: Session = Depends(get_db)) -> list:
    return service.list_produits(db)


@router.get("/{produit_id}", response_model=ProduitRead, dependencies=[Depends(get_current_user)])
def get_produit(produit_id: int, db: Session = Depends(get_db)):
    return service.get_produit(db, produit_id)


@router.post(
    "",
    response_model=ProduitRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(_admin)],
)
def create_produit(body: ProduitCreate, db: Session = Depends(get_db)):
    return service.create_produit(db, body)


@router.patch("/{produit_id}", response_model=ProduitRead, dependencies=[Depends(_admin)])
def update_produit(produit_id: int, body: ProduitUpdate, db: Session = Depends(get_db)):
    return service.update_produit(db, produit_id, body)


@router.delete(
    "/{produit_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(_admin)],
)
def delete_produit(produit_id: int, db: Session = Depends(get_db)) -> None:
    service.delete_produit(db, produit_id)
