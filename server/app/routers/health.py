from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict[str, str]:
    """Liveness probe — used by Docker healthcheck and the PWA connectivity check."""
    return {"status": "ok"}
