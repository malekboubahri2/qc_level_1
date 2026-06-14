"""initial reference schema (client, produit, utilisateur, symptome_catalogue)

Revision ID: 0001_initial
Revises:
Create Date: 2026-06-14
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0001_initial"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_role = sa.Enum(
    "inspecteur", "methode", "qualite", "prod", "admin",
    native_enum=False, length=20,
)
_type_traitement = sa.Enum(
    "peinture", "metallisation", "les_deux",
    native_enum=False, length=20,
)


def upgrade() -> None:
    op.create_table(
        "client",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("code", sa.String(length=32), nullable=False),
        sa.Column("nom", sa.String(length=160), nullable=False),
        sa.Column("actif", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(op.f("ix_client_code"), "client", ["code"], unique=True)

    op.create_table(
        "utilisateur",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("nom", sa.String(length=120), nullable=False),
        sa.Column("role", _role, nullable=False),
        sa.Column("secret_hash", sa.String(length=255), nullable=False),
        sa.Column("telephone", sa.String(length=40), nullable=True),
        sa.Column("actif", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(op.f("ix_utilisateur_nom"), "utilisateur", ["nom"], unique=True)

    op.create_table(
        "produit",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("reference", sa.String(length=64), nullable=False),
        sa.Column("libelle", sa.String(length=200), nullable=False),
        sa.Column("client_id", sa.Integer(), nullable=True),
        sa.Column("type_traitement", _type_traitement, nullable=False),
        sa.Column("actif", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["client_id"], ["client.id"]),
    )
    op.create_index(op.f("ix_produit_reference"), "produit", ["reference"], unique=True)
    op.create_index(op.f("ix_produit_client_id"), "produit", ["client_id"], unique=False)

    op.create_table(
        "symptome_catalogue",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("code", sa.String(length=32), nullable=False),
        sa.Column("libelle_fr", sa.String(length=120), nullable=False),
        sa.Column("libelle_ar", sa.String(length=120), nullable=True),
        sa.Column("famille", sa.String(length=40), nullable=False),
        sa.Column("ordre", sa.Integer(), nullable=False),
        sa.Column("actif", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        op.f("ix_symptome_catalogue_code"), "symptome_catalogue", ["code"], unique=True
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_symptome_catalogue_code"), table_name="symptome_catalogue")
    op.drop_table("symptome_catalogue")
    op.drop_index(op.f("ix_produit_client_id"), table_name="produit")
    op.drop_index(op.f("ix_produit_reference"), table_name="produit")
    op.drop_table("produit")
    op.drop_index(op.f("ix_utilisateur_nom"), table_name="utilisateur")
    op.drop_table("utilisateur")
    op.drop_index(op.f("ix_client_code"), table_name="client")
    op.drop_table("client")
