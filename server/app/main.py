"""FastAPI application entrypoint.

Health lives at both `/health` (Docker healthcheck, internal) and
`/api/v1/health` (browser via the Caddy `/api/*` proxy → PWA connectivity check).
"""
from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .routers import alertes, auth, clients, events, export, health, kpis, produits, push, suivis, symptomes, utilisateurs
from .services.scheduler import expire_alertes_loop


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(expire_alertes_loop())
    yield
    task.cancel()
    await asyncio.gather(task, return_exceptions=True)


app = FastAPI(title="QC Level 1 API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Container-internal liveness probe.
app.include_router(health.router)

# Versioned API surface (everything the browser reaches via /api/*).
api = APIRouter(prefix="/api/v1")
api.include_router(health.router)
api.include_router(auth.router)
api.include_router(clients.router)
api.include_router(produits.router)
api.include_router(utilisateurs.router)
api.include_router(utilisateurs.public_router)
api.include_router(symptomes.router)
api.include_router(suivis.router)
api.include_router(alertes.router)
api.include_router(events.router)
api.include_router(push.router)
api.include_router(kpis.router)
api.include_router(export.router)
app.include_router(api)
