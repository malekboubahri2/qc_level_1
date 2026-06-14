#!/usr/bin/env bash
# Install PROJECT dependencies after the container is created. The toolchain
# itself (uv, Node, pnpm, Docker CLI) is declared in the image/features, not
# here (dev-environment.md). Idempotent — safe to re-run.
set -euo pipefail

echo "▶ pnpm via corepack…"
sudo corepack enable >/dev/null 2>&1 || corepack enable >/dev/null 2>&1 || true
corepack prepare pnpm@9.15.0 --activate >/dev/null 2>&1 || true

if [ -f server/pyproject.toml ]; then
  echo "▶ Server dependencies (uv sync)…"
  ( cd server && uv sync --extra dev )
fi

if [ -f web/package.json ]; then
  echo "▶ Web dependencies (pnpm install)…"
  ( cd web && pnpm install --frozen-lockfile )
fi

cat <<'EOF'

✓ Dev environment ready.
  API  : cd server && uv run uvicorn app.main:app --reload   (http://localhost:8000)
  Web  : cd web && pnpm dev                                  (http://localhost:5173)
  Full : docker compose up --build                           (https://localhost)

  First-time local API setup (Docker does this automatically):
    cd server && uv run alembic upgrade head && uv run python -m app.seed
EOF
