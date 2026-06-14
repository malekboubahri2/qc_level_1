"""Phase 1 operational tables: suivi_qualite_prod, suivi_symptome, visa, alerte, decision.

Revision ID: 0002_operational_tables
Revises: 0001_initial
Create Date: 2026-06-14
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002_operational_tables"
down_revision: str | None = "0001_initial"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_resultat = sa.Enum("OK", "NOK", native_enum=False, length=5)
_severite = sa.Enum("normale", "urgente", native_enum=False, length=10)
_statut_alerte = sa.Enum(
    "ouverte", "acquittee", "cloturee", "expiree", native_enum=False, length=12
)
_type_visa = sa.Enum("qualite", "prod", "methode", native_enum=False, length=10)


def upgrade() -> None:
    op.create_table(
        "suivi_qualite_prod",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("local_uuid", sa.String(length=36), nullable=False),
        sa.Column("date", sa.String(length=10), nullable=False),
        sa.Column("heure", sa.String(length=8), nullable=False),
        sa.Column("num_chariot", sa.String(length=64), nullable=False),
        sa.Column("num_porte_objet", sa.String(length=64), nullable=False),
        sa.Column("client_id", sa.Integer(), nullable=False),
        sa.Column("produit_id", sa.Integer(), nullable=False),
        sa.Column("resultat", _resultat, nullable=False),
        sa.Column("commentaire_decision", sa.Text(), nullable=True),
        sa.Column("inspecteur_id", sa.Integer(), nullable=False),
        sa.Column("niveau3_ref", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["client_id"], ["client.id"]),
        sa.ForeignKeyConstraint(["produit_id"], ["produit.id"]),
        sa.ForeignKeyConstraint(["inspecteur_id"], ["utilisateur.id"]),
    )
    op.create_index(
        op.f("ix_suivi_qualite_prod_local_uuid"),
        "suivi_qualite_prod",
        ["local_uuid"],
        unique=True,
    )
    op.create_index(
        op.f("ix_suivi_qualite_prod_client_id"),
        "suivi_qualite_prod",
        ["client_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_suivi_qualite_prod_produit_id"),
        "suivi_qualite_prod",
        ["produit_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_suivi_qualite_prod_inspecteur_id"),
        "suivi_qualite_prod",
        ["inspecteur_id"],
        unique=False,
    )

    op.create_table(
        "suivi_symptome",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("suivi_id", sa.Integer(), nullable=False),
        sa.Column("symptome_id", sa.Integer(), nullable=False),
        sa.Column("present", sa.Boolean(), nullable=False),
        sa.Column("note", sa.String(length=255), nullable=True),
        sa.ForeignKeyConstraint(["suivi_id"], ["suivi_qualite_prod.id"]),
        sa.ForeignKeyConstraint(["symptome_id"], ["symptome_catalogue.id"]),
    )
    op.create_index(
        op.f("ix_suivi_symptome_suivi_id"), "suivi_symptome", ["suivi_id"], unique=False
    )
    op.create_index(
        op.f("ix_suivi_symptome_symptome_id"),
        "suivi_symptome",
        ["symptome_id"],
        unique=False,
    )

    op.create_table(
        "visa",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("suivi_id", sa.Integer(), nullable=False),
        sa.Column("type", _type_visa, nullable=False),
        sa.Column("utilisateur_id", sa.Integer(), nullable=False),
        sa.Column("signed_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["suivi_id"], ["suivi_qualite_prod.id"]),
        sa.ForeignKeyConstraint(["utilisateur_id"], ["utilisateur.id"]),
    )
    op.create_index(
        op.f("ix_visa_suivi_id"), "visa", ["suivi_id"], unique=False
    )

    # alerte is created before decision to avoid circular FK at DDL time.
    # alerte.decision_id is a plain Integer (no FK constraint) to break the cycle;
    # integrity is maintained by the service layer.
    op.create_table(
        "alerte",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("local_uuid", sa.String(length=36), nullable=False),
        sa.Column("suivi_id", sa.Integer(), nullable=False),
        sa.Column("produit_id", sa.Integer(), nullable=False),
        sa.Column("num_chariot", sa.String(length=64), nullable=False),
        sa.Column("severite", _severite, nullable=False),
        sa.Column("demandeur_id", sa.Integer(), nullable=False),
        sa.Column("responsable_cible_id", sa.Integer(), nullable=False),
        sa.Column("statut", _statut_alerte, nullable=False),
        sa.Column("acknowledged_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("acknowledged_by", sa.Integer(), nullable=True),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("decision_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["suivi_id"], ["suivi_qualite_prod.id"]),
        sa.ForeignKeyConstraint(["produit_id"], ["produit.id"]),
        sa.ForeignKeyConstraint(["demandeur_id"], ["utilisateur.id"]),
        sa.ForeignKeyConstraint(["responsable_cible_id"], ["utilisateur.id"]),
        sa.ForeignKeyConstraint(["acknowledged_by"], ["utilisateur.id"]),
    )
    op.create_index(
        op.f("ix_alerte_local_uuid"), "alerte", ["local_uuid"], unique=True
    )
    op.create_index(
        op.f("ix_alerte_suivi_id"), "alerte", ["suivi_id"], unique=False
    )
    op.create_index(
        op.f("ix_alerte_demandeur_id"), "alerte", ["demandeur_id"], unique=False
    )
    op.create_index(
        op.f("ix_alerte_responsable_cible_id"),
        "alerte",
        ["responsable_cible_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_alerte_statut"), "alerte", ["statut"], unique=False
    )

    op.create_table(
        "decision",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("alerte_id", sa.Integer(), nullable=False),
        sa.Column("suivi_id", sa.Integer(), nullable=False),
        sa.Column("responsable_id", sa.Integer(), nullable=False),
        sa.Column("action_text", sa.Text(), nullable=False),
        sa.Column("resultat_text", sa.Text(), nullable=True),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["alerte_id"], ["alerte.id"]),
        sa.ForeignKeyConstraint(["suivi_id"], ["suivi_qualite_prod.id"]),
        sa.ForeignKeyConstraint(["responsable_id"], ["utilisateur.id"]),
    )
    op.create_index(
        op.f("ix_decision_alerte_id"), "decision", ["alerte_id"], unique=False
    )
    op.create_index(
        op.f("ix_decision_suivi_id"), "decision", ["suivi_id"], unique=False
    )


def downgrade() -> None:
    op.drop_table("decision")
    op.drop_index(op.f("ix_alerte_statut"), table_name="alerte")
    op.drop_index(op.f("ix_alerte_responsable_cible_id"), table_name="alerte")
    op.drop_index(op.f("ix_alerte_demandeur_id"), table_name="alerte")
    op.drop_index(op.f("ix_alerte_suivi_id"), table_name="alerte")
    op.drop_index(op.f("ix_alerte_local_uuid"), table_name="alerte")
    op.drop_table("alerte")
    op.drop_index(op.f("ix_visa_suivi_id"), table_name="visa")
    op.drop_table("visa")
    op.drop_index(op.f("ix_suivi_symptome_symptome_id"), table_name="suivi_symptome")
    op.drop_index(op.f("ix_suivi_symptome_suivi_id"), table_name="suivi_symptome")
    op.drop_table("suivi_symptome")
    op.drop_index(
        op.f("ix_suivi_qualite_prod_inspecteur_id"), table_name="suivi_qualite_prod"
    )
    op.drop_index(
        op.f("ix_suivi_qualite_prod_produit_id"), table_name="suivi_qualite_prod"
    )
    op.drop_index(
        op.f("ix_suivi_qualite_prod_client_id"), table_name="suivi_qualite_prod"
    )
    op.drop_index(
        op.f("ix_suivi_qualite_prod_local_uuid"), table_name="suivi_qualite_prod"
    )
    op.drop_table("suivi_qualite_prod")
