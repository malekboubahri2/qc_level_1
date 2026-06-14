from __future__ import annotations

from sqlalchemy import Boolean, Enum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, TimestampMixin
from .enums import TypeTraitement


class Produit(Base, TimestampMixin):
    __tablename__ = "produit"

    id: Mapped[int] = mapped_column(primary_key=True)
    reference: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    libelle: Mapped[str] = mapped_column(String(200))
    client_id: Mapped[int | None] = mapped_column(
        ForeignKey("client.id"), nullable=True, index=True
    )
    type_traitement: Mapped[TypeTraitement] = mapped_column(
        Enum(TypeTraitement, native_enum=False, length=20),
        default=TypeTraitement.peinture,
        nullable=False,
    )
    actif: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
