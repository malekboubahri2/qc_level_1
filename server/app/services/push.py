"""Web Push notification service.

Architecture (ADR-0003):
  NotificationSender is an interface (Protocol) so the transport can be
  swapped without touching callers.  The concrete VapidSender uses pywebpush
  + VAPID; a future swap to self-hosted ntfy/UnifiedPush is one class change.

VAPID keys are generated on first call and persisted to /data/vapid.json
(the Docker data volume) so they survive container restarts.
"""
from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Protocol

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..models import PushSubscription, Utilisateur

logger = logging.getLogger(__name__)
_VAPID_PATH = Path("/data/vapid.json")
_DEV_VAPID_PATH = Path("/tmp/vapid_dev.json")


# ── VAPID key management ──────────────────────────────────────────────────────

def _key_path() -> Path:
    p = _VAPID_PATH if _VAPID_PATH.parent.exists() else _DEV_VAPID_PATH
    return p


def _load_or_generate_keys() -> tuple[str, str]:
    """Return (private_key_pem, public_key_b64url). Generate + persist if absent."""
    path = _key_path()
    if path.exists():
        data = json.loads(path.read_text())
        return data["private_key"], data["public_key"]

    from cryptography.hazmat.primitives.asymmetric import ec
    from cryptography.hazmat.primitives import serialization
    import base64

    key = ec.generate_private_key(ec.SECP256R1())
    priv_pem = key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.TraditionalOpenSSL,
        serialization.NoEncryption(),
    ).decode()
    pub_raw = key.public_key().public_bytes(
        serialization.Encoding.X962,
        serialization.PublicFormat.UncompressedPoint,
    )
    pub_b64 = base64.urlsafe_b64encode(pub_raw).rstrip(b"=").decode()

    path.write_text(json.dumps({"private_key": priv_pem, "public_key": pub_b64}))
    logger.info("push: generated new VAPID keys → %s", path)
    return priv_pem, pub_b64


_private_key: str | None = None
_public_key: str | None = None


def get_vapid_public_key() -> str:
    global _private_key, _public_key
    if _public_key is None:
        _private_key, _public_key = _load_or_generate_keys()
    return _public_key


def _get_private_key() -> str:
    global _private_key, _public_key
    if _private_key is None:
        _private_key, _public_key = _load_or_generate_keys()
    return _private_key


# ── Sender interface (Protocol = structural subtyping) ────────────────────────

class NotificationSender(Protocol):
    def send(
        self,
        endpoint: str,
        p256dh: str,
        auth: str,
        payload: dict,
    ) -> None: ...


class VapidSender:
    """pywebpush + VAPID transport."""

    def send(self, endpoint: str, p256dh: str, auth: str, payload: dict) -> None:
        try:
            from pywebpush import webpush, WebPushException

            webpush(
                subscription_info={
                    "endpoint": endpoint,
                    "keys": {"p256dh": p256dh, "auth": auth},
                },
                data=json.dumps(payload),
                vapid_private_key=_get_private_key(),
                vapid_claims={"sub": settings.vapid_claims_email},
            )
        except Exception as exc:
            # Best-effort — never let a push failure block the request.
            logger.warning("push: failed to send to %s: %s", endpoint[:60], exc)


_sender: NotificationSender = VapidSender()


def set_sender(s: NotificationSender) -> None:
    """Replace the active sender (e.g. in tests or for an ntfy swap)."""
    global _sender
    _sender = s


# ── Subscription management ──────────────────────────────────────────────────

def subscribe(
    db: Session,
    user: Utilisateur,
    endpoint: str,
    p256dh: str,
    auth: str,
    user_agent: str | None,
) -> PushSubscription:
    # Upsert by endpoint (a user may rotate keys on the same browser).
    existing = db.execute(
        select(PushSubscription).where(PushSubscription.endpoint == endpoint)
    ).scalar_one_or_none()
    if existing:
        existing.utilisateur_id = user.id
        existing.p256dh = p256dh
        existing.auth = auth
        existing.user_agent = user_agent
        db.commit()
        db.refresh(existing)
        return existing
    sub = PushSubscription(
        utilisateur_id=user.id,
        endpoint=endpoint,
        p256dh=p256dh,
        auth=auth,
        user_agent=user_agent,
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return sub


def unsubscribe(db: Session, endpoint: str) -> None:
    sub = db.execute(
        select(PushSubscription).where(PushSubscription.endpoint == endpoint)
    ).scalar_one_or_none()
    if sub:
        db.delete(sub)
        db.commit()


def notify_user(db: Session, utilisateur_id: int, payload: dict) -> None:
    """Send push to all subscriptions for a user. Best-effort."""
    subs = db.execute(
        select(PushSubscription).where(
            PushSubscription.utilisateur_id == utilisateur_id
        )
    ).scalars().all()
    for sub in subs:
        _sender.send(sub.endpoint, sub.p256dh, sub.auth, payload)


def notify_all_methode(db: Session, payload: dict) -> None:
    """Broadcast to all methode users — used for expiry escalation."""
    from ..models.enums import Role
    users = db.execute(
        select(Utilisateur).where(
            Utilisateur.role == Role.methode, Utilisateur.actif.is_(True)
        )
    ).scalars().all()
    for user in users:
        notify_user(db, user.id, payload)
