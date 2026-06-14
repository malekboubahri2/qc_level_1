"""Push subscription management and VAPID public key exposure."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import get_current_user
from ..models import Utilisateur
from ..schemas.push import PushSubscribeRequest, PushUnsubscribeRequest
from ..services import push as svc

router = APIRouter(prefix="/push", tags=["push"])


@router.get("/vapid-public-key")
def vapid_public_key() -> dict:
    return {"public_key": svc.get_vapid_public_key()}


@router.post("/subscribe", status_code=201)
def subscribe(
    body: PushSubscribeRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: Utilisateur = Depends(get_current_user),
) -> dict:
    ua = request.headers.get("user-agent")
    sub = svc.subscribe(db, user, body.endpoint, body.p256dh, body.auth, ua)
    return {"id": sub.id}


@router.delete("/subscribe", status_code=204)
def unsubscribe(
    endpoint: str,
    db: Session = Depends(get_db),
    _: Utilisateur = Depends(get_current_user),
) -> None:
    svc.unsubscribe(db, endpoint)
