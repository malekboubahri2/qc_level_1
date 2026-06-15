#!/usr/bin/env bash
# trust-ca.sh — Extract Caddy's internal CA certificate so you can install it
# on client devices (tablets, PCs, phones) to trust the HTTPS connection.
#
# Run on the Pi:  bash deploy/trust-ca.sh
# Then distribute caddy-ca.crt to each device and install it as a trusted CA.
set -euo pipefail

PROJECT_NAME="qc_level1"
OUT="caddy-ca.crt"

WEB_CONTAINER=$(docker compose -p "$PROJECT_NAME" \
  -f docker-compose.yml -f deploy/docker-compose.prod.yml \
  ps --format '{{.Name}}' web 2>/dev/null | head -1)

[ -n "$WEB_CONTAINER" ] || { echo "Web container not running. Start the stack first."; exit 1; }

docker exec "$WEB_CONTAINER" \
  cat /data/caddy/pki/authorities/local/root.crt > "$OUT"

echo "CA certificate saved to: $OUT"
echo ""
echo "Install on each client device:"
echo "  Android  → Settings → Security → Install certificate → CA certificate"
echo "  iOS/iPadOS → AirDrop the file → Settings → Profile → Install"
echo "  Windows  → Double-click → Install → Trusted Root Certification Authorities"
echo "  Linux    → sudo cp $OUT /usr/local/share/ca-certificates/ && sudo update-ca-certificates"
