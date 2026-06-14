"""Operational suivi tables: SuiviQualiteProd, SuiviSymptome, Visa."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin
from .enums import Resultat, TypeVisa


class SuiviQualiteProd(Base, TimestampMixin):
    __tablename__ = "suivi_qualite_prod"

    id: Mapped[int] = mapped_column(primary_key=True)
    # Client-generated UUID for offline-first idempotent sync.
    local_uuid: Mapped[str] = mapped_column(String(36), unique=True, index=True)
    # ISO date + time stored as strings; timestamps UTC on the wire.
    date: Mapped[str] = mapped_column(String(10), nullable=False)
    heure: Mapped[str] = mapped_column(String(8), nullable=False)
    num_chariot: Mapped[str] = mapped_column(String(64), nullable=False)
    num_porte_objet: Mapped[str] = mapped_column(String(64), nullable=False)
    client_id: Mapped[int] = mapped_column(ForeignKey("client.id"), index=True)
    produit_id: Mapped[int] = mapped_column(ForeignKey("produit.id"), index=True)
    resultat: Mapped[Resultat] = mapped_column(
        Enum(Resultat, native_enum=False, length=5), nullable=False
    )
    commentaire_decision: Mapped[str | None] = mapped_column(Text, nullable=True)
    inspecteur_id: Mapped[int] = mapped_column(
        ForeignKey("utilisateur.id"), index=True
    )
    # Future link to Level-3; nullable until Phase 3.
    niveau3_ref: Mapped[str | None] = mapped_column(String(64), nullable=True)

    symptomes: Mapped[list[SuiviSymptome]] = relationship(
        back_populates="suivi", cascade="all, delete-orphan"
    )
    visas: Mapped[list[Visa]] = relationship(
        back_populates="suivi", cascade="all, delete-orphan"
    )


class SuiviSymptome(Base):
    __tablename__ = "suivi_symptome"

    id: Mapped[int] = mapped_column(primary_key=True)
    suivi_id: Mapped[int] = mapped_column(
        ForeignKey("suivi_qualite_prod.id"), index=True
    )
    symptome_id: Mapped[int] = mapped_column(
        ForeignKey("symptome_catalogue.id"), index=True
    )
    present: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    note: Mapped[str | None] = mapped_column(String(255), nullable=True)

    suivi: Mapped[SuiviQualiteProd] = relationship(back_populates="symptomes")


class Visa(Base):
    __tablename__ = "visa"

    id: Mapped[int] = mapped_column(primary_key=True)
    suivi_id: Mapped[int] = mapped_column(
        ForeignKey("suivi_qualite_prod.id"), index=True
    )
    type: Mapped[TypeVisa] = mapped_column(
        Enum(TypeVisa, native_enum=False, length=10), nullable=False
    )
    utilisateur_id: Mapped[int] = mapped_column(ForeignKey("utilisateur.id"))
    signed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    suivi: Mapped[SuiviQualiteProd] = relationship(back_populates="visas")
