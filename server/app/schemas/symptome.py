from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class SymptomeCreate(BaseModel):
    code: str = Field(min_length=1, max_length=32)
    libelle_fr: str = Field(min_length=1, max_length=120)
    libelle_ar: str | None = Field(default=None, max_length=120)
    famille: str = Field(default="surface", max_length=40)
    ordre: int = 0
    actif: bool = True


class SymptomeUpdate(BaseModel):
    code: str | None = Field(default=None, min_length=1, max_length=32)
    libelle_fr: str | None = Field(default=None, min_length=1, max_length=120)
    libelle_ar: str | None = Field(default=None, max_length=120)
    famille: str | None = Field(default=None, max_length=40)
    ordre: int | None = None
    actif: bool | None = None


class SymptomeRead(BaseModel):
    id: int
    code: str
    libelle_fr: str
    libelle_ar: str | None
    famille: str
    ordre: int
    actif: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
