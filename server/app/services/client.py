from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Client
from ..schemas.client import ClientCreate, ClientUpdate


def list_clients(db: Session) -> list[Client]:
    return list(db.execute(select(Client).order_by(Client.code)).scalars())


def get_client(db: Session, client_id: int) -> Client:
    client = db.get(Client, client_id)
    if client is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Client introuvable")
    return client


def _code_taken(db: Session, code: str, exclude_id: int | None = None) -> bool:
    stmt = select(Client.id).where(Client.code == code)
    if exclude_id is not None:
        stmt = stmt.where(Client.id != exclude_id)
    return db.execute(stmt).first() is not None


def create_client(db: Session, data: ClientCreate) -> Client:
    if _code_taken(db, data.code):
        raise HTTPException(status.HTTP_409_CONFLICT, "Code client déjà utilisé")
    client = Client(**data.model_dump())
    db.add(client)
    db.commit()
    db.refresh(client)
    return client


def update_client(db: Session, client_id: int, data: ClientUpdate) -> Client:
    client = get_client(db, client_id)
    fields = data.model_dump(exclude_unset=True)
    if "code" in fields and _code_taken(db, fields["code"], exclude_id=client_id):
        raise HTTPException(status.HTTP_409_CONFLICT, "Code client déjà utilisé")
    for key, value in fields.items():
        setattr(client, key, value)
    db.commit()
    db.refresh(client)
    return client


def delete_client(db: Session, client_id: int) -> None:
    client = get_client(db, client_id)
    db.delete(client)
    db.commit()
