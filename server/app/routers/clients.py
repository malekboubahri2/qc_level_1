from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import get_current_user, require_roles
from ..models.enums import Role
from ..schemas.client import ClientCreate, ClientRead, ClientUpdate
from ..services import client as service

router = APIRouter(prefix="/clients", tags=["clients"])
_admin = require_roles(Role.admin)


@router.get("", response_model=list[ClientRead], dependencies=[Depends(get_current_user)])
def list_clients(db: Session = Depends(get_db)) -> list:
    return service.list_clients(db)


@router.get("/{client_id}", response_model=ClientRead, dependencies=[Depends(get_current_user)])
def get_client(client_id: int, db: Session = Depends(get_db)):
    return service.get_client(db, client_id)


@router.post(
    "",
    response_model=ClientRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(_admin)],
)
def create_client(body: ClientCreate, db: Session = Depends(get_db)):
    return service.create_client(db, body)


@router.patch("/{client_id}", response_model=ClientRead, dependencies=[Depends(_admin)])
def update_client(client_id: int, body: ClientUpdate, db: Session = Depends(get_db)):
    return service.update_client(db, client_id, body)


@router.delete(
    "/{client_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(_admin)],
)
def delete_client(client_id: int, db: Session = Depends(get_db)) -> None:
    service.delete_client(db, client_id)
