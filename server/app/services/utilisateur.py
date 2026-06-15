from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Utilisateur
from ..models.enums import Role
from ..schemas.utilisateur import UtilisateurCreate, UtilisateurUpdate
from ..security import hash_secret


def list_methode_actifs(db: Session) -> list[Utilisateur]:
    return list(
        db.execute(
            select(Utilisateur)
            .where(Utilisateur.role == Role.methode, Utilisateur.actif.is_(True))
            .order_by(Utilisateur.nom)
        ).scalars()
    )


def list_utilisateurs(db: Session) -> list[Utilisateur]:
    return list(db.execute(select(Utilisateur).order_by(Utilisateur.nom)).scalars())


def get_utilisateur(db: Session, user_id: int) -> Utilisateur:
    user = db.get(Utilisateur, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Utilisateur introuvable")
    return user


def _nom_taken(db: Session, nom: str, exclude_id: int | None = None) -> bool:
    stmt = select(Utilisateur.id).where(Utilisateur.nom == nom)
    if exclude_id is not None:
        stmt = stmt.where(Utilisateur.id != exclude_id)
    return db.execute(stmt).first() is not None


def create_utilisateur(db: Session, data: UtilisateurCreate) -> Utilisateur:
    if _nom_taken(db, data.nom):
        raise HTTPException(status.HTTP_409_CONFLICT, "Nom déjà utilisé")
    user = Utilisateur(
        nom=data.nom,
        role=data.role,
        telephone=data.telephone,
        actif=data.actif,
        secret_hash=hash_secret(data.secret),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def update_utilisateur(
    db: Session, user_id: int, data: UtilisateurUpdate
) -> Utilisateur:
    user = get_utilisateur(db, user_id)
    fields = data.model_dump(exclude_unset=True)
    if "nom" in fields and _nom_taken(db, fields["nom"], exclude_id=user_id):
        raise HTTPException(status.HTTP_409_CONFLICT, "Nom déjà utilisé")
    secret = fields.pop("secret", None)
    if secret is not None:
        user.secret_hash = hash_secret(secret)
    for key, value in fields.items():
        setattr(user, key, value)
    db.commit()
    db.refresh(user)
    return user


def delete_utilisateur(db: Session, user_id: int) -> None:
    user = get_utilisateur(db, user_id)
    db.delete(user)
    db.commit()
