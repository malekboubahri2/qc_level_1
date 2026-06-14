from __future__ import annotations

from sqlalchemy import Boolean, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, TimestampMixin


class SymptomeCatalogue(Base, TimestampMixin):
    """The precursor catalogue (Défauts détectés on SVI-COQ-03)."""

    __tablename__ = "symptome_catalogue"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    libelle_fr: Mapped[str] = mapped_column(String(120))
    libelle_ar: Mapped[str | None] = mapped_column(String(120), nullable=True)
    famille: Mapped[str] = mapped_column(String(40), default="surface", nullable=False)
    ordre: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    actif: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
