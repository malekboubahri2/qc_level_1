"""Idempotent seed: an admin user, the 5 precursors, and a demo client/produit.

Run after `alembic upgrade head`:  `uv run python -m app.seed`
Safe to run repeatedly — it only inserts what is missing.
"""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import settings
from .db import SessionLocal
from .models import Client, Produit, SymptomeCatalogue, Utilisateur
from .models.enums import Role, TypeTraitement
from .security import hash_secret

# Precursor catalogue — seed exactly these (qc-level1.md §2).
PRECURSEURS: list[tuple[str, str]] = [
    ("APPLICATION", "Application"),
    ("COULEUR", "Couleur"),
    ("POUSSIERE", "Poussière"),
    ("CHUTE", "Chute"),
    ("AUTRES", "Autres"),
]


def _seed_admin(db: Session) -> bool:
    exists = db.execute(
        select(Utilisateur.id).where(Utilisateur.nom == settings.admin_nom)
    ).first()
    if exists:
        return False
    db.add(
        Utilisateur(
            nom=settings.admin_nom,
            role=Role.admin,
            secret_hash=hash_secret(settings.admin_secret),
            actif=True,
        )
    )
    return True


def _seed_precurseurs(db: Session) -> int:
    count = 0
    for ordre, (code, libelle) in enumerate(PRECURSEURS, start=1):
        present = db.execute(
            select(SymptomeCatalogue.id).where(SymptomeCatalogue.code == code)
        ).first()
        if present:
            continue
        db.add(
            SymptomeCatalogue(
                code=code, libelle_fr=libelle, famille="surface", ordre=ordre, actif=True
            )
        )
        count += 1
    return count


def _seed_demo(db: Session) -> None:
    client = db.execute(
        select(Client).where(Client.code == "DEMO")
    ).scalar_one_or_none()
    if client is None:
        client = Client(code="DEMO", nom="Client Démo", actif=True)
        db.add(client)
        db.flush()  # assign client.id for the produit FK below

    produit_exists = db.execute(
        select(Produit.id).where(Produit.reference == "DEMO-001")
    ).first()
    if not produit_exists:
        db.add(
            Produit(
                reference="DEMO-001",
                libelle="Pièce de démonstration",
                client_id=client.id,
                type_traitement=TypeTraitement.les_deux,
                actif=True,
            )
        )


def run() -> None:
    db = SessionLocal()
    try:
        admin_created = _seed_admin(db)
        precurseurs_added = _seed_precurseurs(db)
        _seed_demo(db)
        db.commit()
    finally:
        db.close()

    print(f"seed: admin {'created' if admin_created else 'present'}")
    print(f"seed: {precurseurs_added} precursor(s) added")
    print("seed: demo client/produit ensured")
    if admin_created and settings.admin_secret == "admin":
        print(
            "WARNING: admin seeded with the default secret 'admin'. "
            "Set QC_ADMIN_SECRET before exposing this server."
        )


if __name__ == "__main__":
    run()
