"""Escalation tables: Alerte and Decision."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin
from .enums import Severite, StatutAlerte


class Alerte(Base, TimestampMixin):
    __tablename__ = "alerte"

    id: Mapped[int] = mapped_column(primary_key=True)
    local_uuid: Mapped[str] = mapped_column(String(36), unique=True, index=True)
    suivi_id: Mapped[int] = mapped_column(
        ForeignKey("suivi_qualite_prod.id"), index=True
    )
    produit_id: Mapped[int] = mapped_column(ForeignKey("produit.id"))
    num_chariot: Mapped[str] = mapped_column(String(64), nullable=False)
    severite: Mapped[Severite] = mapped_column(
        Enum(Severite, native_enum=False, length=10), nullable=False
    )
    demandeur_id: Mapped[int] = mapped_column(
        ForeignKey("utilisateur.id"), index=True
    )
    responsable_cible_id: Mapped[int] = mapped_column(
        ForeignKey("utilisateur.id"), index=True
    )
    statut: Mapped[StatutAlerte] = mapped_column(
        Enum(StatutAlerte, native_enum=False, length=12),
        nullable=False,
        default=StatutAlerte.ouverte,
    )
    acknowledged_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    acknowledged_by: Mapped[int | None] = mapped_column(
        ForeignKey("utilisateur.id"), nullable=True
    )
    closed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # Convenience pointer set after the Decision row is created.
    # Plain Integer (no FK constraint) to avoid circular DDL dependency.
    decision_id: Mapped[int | None] = mapped_column(Integer, nullable=True)

    decisions: Mapped[list[Decision]] = relationship(
        "Decision", back_populates="alerte", foreign_keys="Decision.alerte_id"
    )


class Decision(Base):
    __tablename__ = "decision"

    id: Mapped[int] = mapped_column(primary_key=True)
    alerte_id: Mapped[int] = mapped_column(ForeignKey("alerte.id"), index=True)
    suivi_id: Mapped[int] = mapped_column(
        ForeignKey("suivi_qualite_prod.id"), index=True
    )
    responsable_id: Mapped[int] = mapped_column(ForeignKey("utilisateur.id"))
    action_text: Mapped[str] = mapped_column(Text, nullable=False)
    resultat_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    decided_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    alerte: Mapped[Alerte] = relationship(
        "Alerte", back_populates="decisions", foreign_keys=[alerte_id]
    )
