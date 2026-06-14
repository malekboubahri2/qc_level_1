from __future__ import annotations

from pydantic import BaseModel, Field

from ..models.enums import Role


class LoginRequest(BaseModel):
    nom: str = Field(min_length=1, max_length=120)
    secret: str = Field(min_length=1, max_length=256)


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class MeResponse(BaseModel):
    id: int
    nom: str
    role: Role

    model_config = {"from_attributes": True}
