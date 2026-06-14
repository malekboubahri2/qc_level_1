"""SSE endpoint — `GET /api/v1/events`.

EventSource doesn't support custom headers, so the JWT may arrive either as
the standard Bearer header *or* as a `?token=` query parameter.  We accept
both; the query-param path is the one browsers use from EventSource.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from starlette.requests import Request
from starlette.responses import StreamingResponse

from ..db import get_db
from ..deps import get_current_user
from ..models import Utilisateur
from ..security import ACCESS, decode_token
from ..services.sse import broker

router = APIRouter(tags=["events"])

_bearer = HTTPBearer(auto_error=False)

_UNAUTH_FRAME = "event: error\ndata: {\"detail\": \"Authentification requise\"}\n\n"


async def _resolve_user(
    request: Request,
    token_param: str | None = Query(None, alias="token"),
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> Utilisateur | None:
    import jwt

    raw = (creds.credentials if creds else None) or token_param
    if not raw:
        return None
    try:
        payload = decode_token(raw)
    except jwt.PyJWTError:
        return None
    if payload.get("type") != ACCESS:
        return None

    db = next(get_db())
    try:
        user = db.get(Utilisateur, int(payload["sub"]))
        return user if (user and user.actif) else None
    finally:
        db.close()


@router.get("/events")
async def events(user: Utilisateur | None = Depends(_resolve_user)) -> StreamingResponse:
    if user is None:
        async def _deny():
            yield _UNAUTH_FRAME
        return StreamingResponse(
            _deny(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    q = broker.subscribe()

    return StreamingResponse(
        broker.stream(q),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
