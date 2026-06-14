# QC Level 1 (PMP) — Project Config

> The active configuration is **composed in layers**, each auto-read:
> 1. `base/.claude/rules/` — generic engineering principles, way-of-working,
>    commits, docs. They govern *how* to build.
> 2. `clients/pmp/.claude/rules/` — the PMP overlay: `tech-stack.md` (locked
>    stack), `visual-identity.md` + `clients/pmp/assets/theme.css` (brand).
> 3. `.claude/rules/qc-level1.md` — this project's **domain** (the SVI-COQ-03
>    early-warning tool, the escalation loop, the data model).
>
> Where a lower layer is silent, the layer above it decides. Read those before
> changing anything; this stub stays short.

## This project

- **What it is:** QC Level 1 — an on-premise, in-production **early-warning**
  tool. A line inspector logs an early symptom (precursor) on a chariot,
  digitizing the paper `Fiche Suivi Qualité Prod` (SVI-COQ-03), and **summons a
  méthode responsable** through a traceable escalation → décision loop.
- **Primary surface / selling point:** the React **PWA** (line tablet
  offline-first; office-screen kiosk for the méthode; phone for push later).
- **Components:** `server/` (FastAPI + SQLite + Alembic) · `web/` (React + Vite
  PWA) · `infra/` (Docker Compose + Caddy HTTPS). No firmware, **no MQTT**
  (symptoms are human-observed — broker pruned from the stack).
- **Run:** `docker compose up --build` (full stack behind Caddy). Server alone:
  `cd server && uv run uvicorn app.main:app --reload`. Web alone:
  `cd web && pnpm dev`.
- **Status:** **Phase 0 (Scaffold)** — FastAPI + DB + Alembic + auth/roles,
  seed, reference CRUD, PWA shell with role routing + brand, Docker + Caddy,
  `/health`. Next: Phase 1 (the core suivi + escalation loop).
- **Project don'ts:** never blur **alerting (online-only)** with **suivi
  (offline-first)**; never mark an alerte delivered/acknowledged without server
  confirmation; migrations are the *only* way the schema changes; UTC on the
  wire, `fr-TN` only in the UI.
