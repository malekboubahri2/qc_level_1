#!/usr/bin/env bash
# update.sh — Pull latest code and redeploy QC Level 1 in-place.
#
# Run on the Pi from the repo directory:
#   bash deploy/update.sh
#
# Safe to run while the app is live — containers are replaced one at a time.
set -euo pipefail

PROJECT_NAME="qc_level1"
COMPOSE_CMD="docker compose"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[qc-update]${NC} $*"; }
warn()  { echo -e "${YELLOW}[qc-update]${NC} $*"; }
error() { echo -e "${RED}[qc-update]${NC} $*" >&2; exit 1; }

[ -f docker-compose.yml ] || error "Run this script from the repo root (where docker-compose.yml lives)."
[ -f .env ]               || error ".env not found. Run deploy/install.sh first."

# ── 1. Pull latest code ───────────────────────────────────────────────────────
info "Pulling latest code…"
git pull --ff-only

# ── 2. Rebuild images ─────────────────────────────────────────────────────────
info "Rebuilding images…"
$COMPOSE_CMD -p "$PROJECT_NAME" \
  -f docker-compose.yml \
  -f deploy/docker-compose.prod.yml \
  build

# ── 3. Restart containers ─────────────────────────────────────────────────────
info "Restarting containers…"
$COMPOSE_CMD -p "$PROJECT_NAME" \
  -f docker-compose.yml \
  -f deploy/docker-compose.prod.yml \
  up -d --force-recreate

# ── 4. Health check ───────────────────────────────────────────────────────────
info "Waiting for API to become healthy (up to 60s)…"
for i in $(seq 1 12); do
  HTTP=$(curl -sk -o /dev/null -w "%{http_code}" \
    "http://localhost:${QC_HTTP_PORT:-8180}/api/v1/health" 2>/dev/null || echo "0")
  if [ "$HTTP" = "200" ]; then
    info "API healthy."
    break
  fi
  echo -n "."
  sleep 5
done
echo ""

if [ "$HTTP" != "200" ]; then
  warn "API did not respond healthy after 60s. Check logs:"
  warn "  $COMPOSE_CMD -p $PROJECT_NAME logs api --tail 50"
fi

info "Update complete."
