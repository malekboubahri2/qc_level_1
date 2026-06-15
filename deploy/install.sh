#!/usr/bin/env bash
# install.sh — First-time deployment of QC Level 1 on the RPi.
#
# Run on the Pi (as the user who owns /opt, e.g. pi or ubuntu):
#   curl -fsSL https://raw.githubusercontent.com/.../deploy/install.sh | bash
# or after cloning:
#   bash deploy/install.sh
#
# The script is idempotent: re-running it after a failure is safe.
set -euo pipefail

REPO_URL="${REPO_URL:-}"          # set if cloning fresh; leave empty if already in repo
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
info "Prerequisites OK."

# ── 2. Get the code ───────────────────────────────────────────────────────────
if [ -n "$REPO_URL" ]; then
  info "Cloning $REPO_URL → $DEPLOY_DIR"
  git clone "$REPO_URL" "$DEPLOY_DIR"
  cd "$DEPLOY_DIR"
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
  # Detect the Pi's LAN IP for SITE_ADDRESS default
  LAN_IP=$(hostname -I | awk '{print $1}')

  sed -i "s|^QC_SECRET_KEY=.*|QC_SECRET_KEY=${SECRET}|"             .env
  sed -i "s|^SITE_ADDRESS=.*|SITE_ADDRESS=${LAN_IP}|"               .env
  sed -i "s|^QC_CORS_ORIGINS=.*|QC_CORS_ORIGINS=https://${LAN_IP}:\${QC_HTTPS_PORT:-8443}|" .env

  warn "──────────────────────────────────────────────────────────────────────"
  warn ".env created. EDIT IT before going further:"
  warn "  • QC_ADMIN_SECRET  → set a strong admin password"
  warn "  • SITE_ADDRESS     → use a LAN hostname if you have one (e.g. qcl1.atelier.local)"
  warn "  • QC_CORS_ORIGINS  → must match the URL users open in their browser"
  warn "  • QC_HTTP_PORT / QC_HTTPS_PORT → defaults 8180 / 8443"
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
for i in $(seq 1 12); do
  STATUS=$($COMPOSE_CMD -p "$PROJECT_NAME" ps --format json 2>/dev/null \
    | python3 -c "import sys,json; rows=json.load(sys.stdin) if isinstance(json.load(open('/dev/stdin')), list) else []; print('ok')" 2>/dev/null || true)
  HTTP=$(curl -sk -o /dev/null -w "%{http_code}" \
    "http://localhost:${QC_HTTP_PORT:-8180}/api/v1/health" 2>/dev/null || echo "0")
  if [ "$HTTP" = "200" ]; then
    info "API healthy (HTTP $HTTP)."
    break
  fi
  echo -n "."
  sleep 5
done
echo ""

# ── 6. Trust Caddy's CA (optional, interactive) ───────────────────────────────
warn "TLS note: Caddy uses its own internal CA. Install the CA cert on each"
warn "client device once so the browser trusts the HTTPS connection."
warn "The CA cert is at: caddy export-ca-cert (run 'bash deploy/trust-ca.sh' to extract it)"

# ── 7. Done ───────────────────────────────────────────────────────────────────
HTTPS_PORT="${QC_HTTPS_PORT:-8443}"
LAN_IP=$(hostname -I | awk '{print $1}')
SITE=$(grep "^SITE_ADDRESS=" .env 2>/dev/null | cut -d= -f2 | tr -d '"' || echo "$LAN_IP")

info "──────────────────────────────────────────────────────────────────────"
info "QC Level 1 is running."
info "  App  →  https://${SITE}:${HTTPS_PORT}"
info "  API  →  https://${SITE}:${HTTPS_PORT}/api/v1/docs"
info ""
info "  Login: admin / (the QC_ADMIN_SECRET you set in .env)"
info "──────────────────────────────────────────────────────────────────────"
