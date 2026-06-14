from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from ..models.enums import TypeTraitement


class ProduitCreate(BaseModel):
    reference: str = Field(min_length=1, max_length=64)
    libelle: str = Field(min_length=1, max_length=200)
    client_id: int | None = None
    type_traitement: TypeTraitement = TypeTraitement.peinture
    actif: bool = True


class ProduitUpdate(BaseModel):
    reference: str | None = Field(default=None, min_length=1, max_length=64)
    libelle: str | None = Field(default=None, min_length=1, max_length=200)
    client_id: int | None = None
    type_traitement: TypeTraitement | None = None
    actif: bool | None = None


class ProduitRead(BaseModel):
    id: int
    reference: str
    libelle: str
    client_id: int | None
    type_traitement: TypeTraitement
    actif: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
