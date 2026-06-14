"""Phase 2: push_subscription table for Web Push VAPID.

Revision ID: 0003_push_subscription
Revises: 0002_operational_tables
Create Date: 2026-06-14
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003_push_subscription"
down_revision: str | None = "0002_operational_tables"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "push_subscription",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("utilisateur_id", sa.Integer(), nullable=False),
        sa.Column("endpoint", sa.String(length=2048), nullable=False),
        sa.Column("p256dh", sa.String(length=256), nullable=False),
        sa.Column("auth", sa.String(length=64), nullable=False),
        sa.Column("user_agent", sa.String(length=512), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["utilisateur_id"], ["utilisateur.id"]),
    )
    op.create_index(
        op.f("ix_push_subscription_utilisateur_id"),
        "push_subscription",
        ["utilisateur_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_push_subscription_utilisateur_id"),
        table_name="push_subscription",
    )
    op.drop_table("push_subscription")
