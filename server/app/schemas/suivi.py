from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from ..models.enums import Resultat, TypeVisa


class SuiviSymptomeCreate(BaseModel):
    symptome_id: int
    present: bool
    note: str | None = None


class SuiviSymptomeRead(BaseModel):
    id: int
    symptome_id: int
    present: bool
    note: str | None

    model_config = {"from_attributes": True}


class SuiviCreate(BaseModel):
    local_uuid: str = Field(..., min_length=1, max_length=36)
    date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    heure: str = Field(..., pattern=r"^\d{2}:\d{2}(:\d{2})?$")
    num_chariot: str = Field(..., min_length=1, max_length=64)
    num_porte_objet: str = Field(..., min_length=1, max_length=64)
    client_id: int
    produit_id: int
    resultat: Resultat
    commentaire_decision: str | None = None
    symptomes: list[SuiviSymptomeCreate] = Field(default_factory=list)


class SuiviSyncBatch(BaseModel):
    items: list[SuiviCreate]


class VisaCreate(BaseModel):
    type: TypeVisa


class VisaRead(BaseModel):
    id: int
    suivi_id: int
    type: TypeVisa
    utilisateur_id: int
    signed_at: datetime

    model_config = {"from_attributes": True}


class SuiviRead(BaseModel):
    id: int
    local_uuid: str
    date: str
    heure: str
    num_chariot: str
    num_porte_objet: str
    client_id: int
    produit_id: int
    resultat: Resultat
    commentaire_decision: str | None
    inspecteur_id: int
    niveau3_ref: str | None
    created_at: datetime
    updated_at: datetime
    symptomes: list[SuiviSymptomeRead]
    visas: list[VisaRead] = Field(default_factory=list)
    # Resolved from alerte → decision; None when no alerte or decision not yet recorded
    action_methode: str | None = None

    model_config = {"from_attributes": True}
