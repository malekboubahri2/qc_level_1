# QC Level 1 (PMP)

An on-premise, in-production **early-warning** tool for the PMP plant. A line
inspector logs an early symptom (precursor) on a chariot — digitizing the paper
`Fiche Suivi Qualité Prod` (SVI-COQ-03) — and **summons a méthode responsable**
through a fast, traceable escalation → décision loop.

The product is a single React **PWA** (offline-first line tablet, an office
kiosk screen for the méthode, a phone surface for push later) backed by a
FastAPI service, served over HTTPS by Caddy.

> **Status: Phase 0 (Scaffold).** Auth + roles, reference data, the brand PWA
> shell, and the containerised stack are in place. The core suivi + escalation
> loop is Phase 1. See [Roadmap](#roadmap).

## How it's organised

| Path | What it is |
|---|---|
| [server/](server/) | FastAPI + SQLAlchemy 2.0 + Alembic, SQLite (WAL). Routers → services → models. |
| [web/](web/) | React + Vite + TypeScript + Tailwind v4 PWA, with the PMP brand theme. |
| [docker-compose.yml](docker-compose.yml) | The full stack: API + Caddy (static SPA, `/api` proxy, internal-CA TLS). |
| [.devcontainer/](.devcontainer/) | The dev environment — the single source of truth for the toolchain. |
| `base/`, `clients/pmp/`, `.claude/rules/` | Layered engineering + brand + domain rules (see [Conventions](#conventions)). |

## Run it

### In the dev container (recommended)

The repo ships a VS Code dev container that pins the whole toolchain (Python +
uv, Node + pnpm, the Docker CLI). Work inside it so your results match CI and
every teammate.

1. Open the folder in VS Code with the **Dev Containers** extension.
2. **Reopen in Container.** On first build, `post-create` installs all server
   and web dependencies automatically.
3. Use the commands below from the container's terminal.

### The full stack (production-like)

Runs the API and the Caddy-served PWA together over HTTPS:

```bash
cp .env.example .env          # fill in the secrets (a dev .env is provided)
docker compose up --build     # → https://localhost   (login: admin / admin)
```

The API container applies migrations and seeds reference data on startup, so the
first boot is ready to use.

### Each service on its own (fast iteration)

```bash
# API — http://localhost:8000  (docs at /docs)
cd server
uv sync --extra dev
uv run alembic upgrade head     # first run only
uv run python -m app.seed       # first run only
uv run uvicorn app.main:app --reload

# Web — http://localhost:5173  (proxies /api → the API above)
cd web
pnpm install
pnpm dev
```

## Test

```bash
cd server && uv run pytest      # API tests
cd web && pnpm build            # type-check + production build
```

## Configure

All configuration is environment-driven (no hosts, ports, or secrets in source).
Copy `.env.example` to `.env`; Docker Compose reads it.

| Variable | Used by | Purpose |
|---|---|---|
| `SITE_ADDRESS` | Caddy | Hostname served + issued an internal-CA cert (e.g. `qc.atelier.local`). |
| `QC_SECRET_KEY` | API | JWT signing key — set a long random value (`openssl rand -hex 32`). |
| `QC_CORS_ORIGINS` | API | Allowed browser origin(s), comma-separated. |
| `QC_ALERTE_TIMEOUT_SECONDS` | API | Escalation timeout `T` (used from Phase 1). |
| `QC_ADMIN_NOM`, `QC_ADMIN_SECRET` | API | Admin user seeded on first boot if none exists. |
| `QC_DATABASE_URL` | API | SQLite path; set by Compose to the on-volume DB. |

For a standalone local API the defaults work (SQLite in `server/`, a dev key).

## Conventions

Configuration composes in layers, each read automatically:

1. `base/.claude/rules/` — generic engineering principles, way-of-working,
   **commits**, **docs**, and **dev-environment** rules.
2. `clients/pmp/.claude/rules/` — the PMP **tech stack** (locked) and **visual
   identity** (the brand is a feature).
3. `.claude/rules/qc-level1.md` — this project's **domain**: the SVI-COQ-03
   mapping, the data model, and the escalation loop.

When extending the repo: keep alerting **online-only** and suivi
**offline-first** (never blur them); never mark an alerte delivered without
server confirmation; change the schema **only** through an Alembic migration;
keep UTC on the wire and `fr-TN` in the UI.

## Roadmap

- **Phase 0 — Scaffold** *(done)*: API foundation, auth + roles, reference CRUD,
  seed, brand PWA shell with role routing, Docker + Caddy HTTPS, `/health`.
- **Phase 1 — Core loop**: suivi logging (offline-first, idempotent sync), Visa
  Méthode, alerte creation, SSE office screen + ACK, decision capture, the
  connectivity check + manual-alert fallback, server-side timeout → expiree.
- **Phase 2 — Notifications, KPIs, audit**: Web Push + phone surface, KPI
  dashboards, PDF export, Visa Qualité/Prod.
- **Phase 3 — Level 3 sync**: shared reference data and optional `niveau3_ref`.
