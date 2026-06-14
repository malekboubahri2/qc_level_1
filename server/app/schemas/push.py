from __future__ import annotations

from pydantic import BaseModel, Field


class PushSubscribeRequest(BaseModel):
    endpoint: str = Field(..., min_length=1)
    p256dh: str = Field(..., min_length=1)
    auth: str = Field(..., min_length=1)
    user_agent: str | None = None


class PushUnsubscribeRequest(BaseModel):
    endpoint: str = Field(..., min_length=1)
