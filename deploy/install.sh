#!/usr/bin/env bash
# install.sh — First-time deployment of QC Level 1 on the RPi.
#
# Prerequisites:
#   • Docker + Docker Compose v2
#   • The pmp-edge shared ingress must be running and the external Docker
#     network "edge" must exist (bring it up first: cd ~/pmp-edge && docker compose up -d)
#
# Run on the Pi (as the user who owns the deploy directory):
#   bash deploy/install.sh
# or after cloning:
#   REPO_URL=<git-url> bash deploy/install.sh
#
# The script is idempotent: re-running it after a failure is safe.
set -euo pipefail

REPO_URL="${REPO_URL:-}"
DEPLOY_DIR="${DEPLOY_DIR:-/opt/qc_level1}"
PROJECT_NAME="qc_level1"
COMPOSE_CMD="docker compose"

# ── Colour helpers ────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[qc-install]${NC} $*"; }
warn()  { echo -e "${YELLOW}[qc-install]${NC} $*"; }
error() { echo -e "${RED}[qc-install]${NC} $*" >&2; exit 1; }

# ── 1. Prerequisites ──────────────────────────────────────────────────────────
info "Checking prerequisites…"
command -v docker  >/dev/null || error "Docker not found. Install it first: https://docs.docker.com/engine/install/"
docker compose version >/dev/null 2>&1 || error "Docker Compose v2 not found (need 'docker compose', not 'docker-compose')."
command -v git >/dev/null || error "git not found. sudo apt-get install -y git"

# The app sits behind the pmp-edge shared ingress — the "edge" network must exist.
docker network inspect edge >/dev/null 2>&1 \
  || error "External Docker network 'edge' not found. Bring up pmp-edge first:\n  cd ~/pmp-edge && docker compose up -d"

info "Prerequisites OK (edge network present)."

# ── 2. Get the code ───────────────────────────────────────────────────────────
if [ -n "$REPO_URL" ]; then
  info "Cloning $REPO_URL → $DEPLOY_DIR"
  git clone "$REPO_URL" "$DEPLOY_DIR"
  cd "$DEPLOY_DIR"
  git submodule update --init --remote deploy/edge
elif [ -f "docker-compose.yml" ]; then
  info "Running from existing repo at $(pwd)"
  DEPLOY_DIR="$(pwd)"
elif [ -d "$DEPLOY_DIR" ]; then
  info "Using existing directory $DEPLOY_DIR"
  cd "$DEPLOY_DIR"
else
  error "No REPO_URL set and not in a repo directory. Set REPO_URL=<git-url> and re-run."
fi

# ── 3. Create .env if missing ─────────────────────────────────────────────────
if [ ! -f .env ]; then
  info "Creating .env from .env.example…"
  cp .env.example .env

  # Generate a strong secret key
  SECRET=$(openssl rand -hex 32 2>/dev/null || python3 -c "import secrets; print(secrets.token_hex(32))")
  sed -i "s|^QC_SECRET_KEY=.*|QC_SECRET_KEY=${SECRET}|" .env

  warn "──────────────────────────────────────────────────────────────────────"
  warn ".env created. EDIT IT before going further:"
  warn "  • QC_ADMIN_SECRET  → set a strong admin password"
  warn "  • QC_CORS_ORIGINS  → defaults to https://qcl1.pmp.com (change only"
  warn "                       if using a different hostname)"
  warn "──────────────────────────────────────────────────────────────────────"
  read -rp "Press Enter to open the editor, or Ctrl+C to abort and edit manually: "
  ${EDITOR:-nano} .env
else
  info ".env already exists — skipping generation."
fi

# ── 4. Build and start ────────────────────────────────────────────────────────
info "Building images (this takes a few minutes on the Pi)…"
$COMPOSE_CMD -p "$PROJECT_NAME" \
  -f docker-compose.yml \
  -f deploy/docker-compose.prod.yml \
  build

info "Starting containers…"
$COMPOSE_CMD -p "$PROJECT_NAME" \
  -f docker-compose.yml \
  -f deploy/docker-compose.prod.yml \
  up -d

# ── 5. Health check ───────────────────────────────────────────────────────────
info "Waiting for API to become healthy (up to 60s)…"
HTTP="0"
for i in $(seq 1 12); do
  HTTP=$(docker exec "${PROJECT_NAME}-api-1" \
    python3 -c "import urllib.request; print(urllib.request.urlopen('http://localhost:8000/health').status)" \
    2>/dev/null || echo "0")
  if [ "$HTTP" = "200" ]; then
    info "API healthy."
    break
  fi
  echo -n "."
  sleep 5
done
echo ""
[ "$HTTP" = "200" ] || warn "API did not respond in 60s. Check: docker compose -p $PROJECT_NAME logs api"

# ── 6. Done ───────────────────────────────────────────────────────────────────
info "──────────────────────────────────────────────────────────────────────"
info "QC Level 1 is running behind pmp-edge."
info "  App  →  https://qcl1.pmp.com"
info "  API  →  https://qcl1.pmp.com/api/v1/docs"
info ""
info "  Login: admin / (the QC_ADMIN_SECRET you set in .env)"
info ""
info "  CA trust: the edge's CA is shared across all apps on this Pi."
info "  Run:  bash deploy/edge/trust-ca.sh   to extract the root cert."
info "──────────────────────────────────────────────────────────────────────"
