"""Background task: expire ouverte alertes that exceeded the timeout.

Started as an asyncio Task inside the FastAPI lifespan context manager so it
lives for the process lifetime and is cancelled on shutdown.
"""
from __future__ import annotations

import asyncio
import logging

from sqlalchemy.orm import Session

from ..config import settings
from ..db import SessionLocal
from .alerte import expire_due

logger = logging.getLogger(__name__)

_POLL_INTERVAL = 30  # seconds between sweeps


async def expire_alertes_loop() -> None:
    while True:
        await asyncio.sleep(_POLL_INTERVAL)
        db: Session = SessionLocal()
        try:
            n = expire_due(db, settings.alerte_timeout_seconds)
            if n:
                logger.info("scheduler: expired %d alerte(s)", n)
        except Exception:
            logger.exception("scheduler: error during expire sweep")
        finally:
            db.close()
