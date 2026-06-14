from __future__ import annotations

from sqlalchemy import Boolean, Enum, String
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, TimestampMixin
from .enums import Role


class Utilisateur(Base, TimestampMixin):
    __tablename__ = "utilisateur"

    id: Mapped[int] = mapped_column(primary_key=True)
    # `nom` doubles as the login identifier, so it is unique.
    nom: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    role: Mapped[Role] = mapped_column(
        Enum(Role, native_enum=False, length=20), nullable=False
    )
    secret_hash: Mapped[str] = mapped_column(String(255))
    telephone: Mapped[str | None] = mapped_column(String(40), nullable=True)
    actif: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
