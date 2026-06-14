from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from ..models.enums import Role


class UtilisateurCreate(BaseModel):
    nom: str = Field(min_length=1, max_length=120)
    role: Role
    secret: str = Field(min_length=1, max_length=256)
    telephone: str | None = Field(default=None, max_length=40)
    actif: bool = True


class UtilisateurUpdate(BaseModel):
    nom: str | None = Field(default=None, min_length=1, max_length=120)
    role: Role | None = None
    secret: str | None = Field(default=None, min_length=1, max_length=256)
    telephone: str | None = Field(default=None, max_length=40)
    actif: bool | None = None


class UtilisateurRead(BaseModel):
    """Never exposes `secret_hash`."""

    id: int
    nom: str
    role: Role
    telephone: str | None
    actif: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
