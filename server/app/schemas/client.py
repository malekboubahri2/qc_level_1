from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class ClientCreate(BaseModel):
    code: str = Field(min_length=1, max_length=32)
    nom: str = Field(min_length=1, max_length=160)
    actif: bool = True


class ClientUpdate(BaseModel):
    code: str | None = Field(default=None, min_length=1, max_length=32)
    nom: str | None = Field(default=None, min_length=1, max_length=160)
    actif: bool | None = None


class ClientRead(BaseModel):
    id: int
    code: str
    nom: str
    actif: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
