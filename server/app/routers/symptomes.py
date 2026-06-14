from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import get_current_user, require_roles
from ..models.enums import Role
from ..schemas.symptome import SymptomeCreate, SymptomeRead, SymptomeUpdate
from ..services import symptome as service

router = APIRouter(prefix="/symptomes", tags=["symptomes"])
_admin = require_roles(Role.admin)


@router.get("", response_model=list[SymptomeRead], dependencies=[Depends(get_current_user)])
def list_symptomes(db: Session = Depends(get_db)) -> list:
    return service.list_symptomes(db)


@router.get("/{symptome_id}", response_model=SymptomeRead, dependencies=[Depends(get_current_user)])
def get_symptome(symptome_id: int, db: Session = Depends(get_db)):
    return service.get_symptome(db, symptome_id)


@router.post(
    "",
    response_model=SymptomeRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(_admin)],
)
def create_symptome(body: SymptomeCreate, db: Session = Depends(get_db)):
    return service.create_symptome(db, body)


@router.patch("/{symptome_id}", response_model=SymptomeRead, dependencies=[Depends(_admin)])
def update_symptome(symptome_id: int, body: SymptomeUpdate, db: Session = Depends(get_db)):
    return service.update_symptome(db, symptome_id, body)


@router.delete(
    "/{symptome_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(_admin)],
)
def delete_symptome(symptome_id: int, db: Session = Depends(get_db)) -> None:
    service.delete_symptome(db, symptome_id)
