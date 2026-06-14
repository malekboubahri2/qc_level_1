from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from ..models.enums import Severite, StatutAlerte


class AlerteCreate(BaseModel):
    local_uuid: str = Field(..., min_length=1, max_length=36)
    suivi_id: int
    produit_id: int
    num_chariot: str = Field(..., min_length=1, max_length=64)
    severite: Severite
    responsable_cible_id: int


class AlerteRead(BaseModel):
    id: int
    local_uuid: str
    suivi_id: int
    produit_id: int
    num_chariot: str
    severite: Severite
    demandeur_id: int
    responsable_cible_id: int
    statut: StatutAlerte
    acknowledged_at: datetime | None
    acknowledged_by: int | None
    closed_at: datetime | None
    decision_id: int | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DecisionCreate(BaseModel):
    action_text: str = Field(..., min_length=1)
    resultat_text: str | None = None


class DecisionRead(BaseModel):
    id: int
    alerte_id: int
    suivi_id: int
    responsable_id: int
    action_text: str
    resultat_text: str | None
    decided_at: datetime

    model_config = {"from_attributes": True}
