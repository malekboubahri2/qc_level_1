#!/bin/sh
# Apply migrations and seed reference data before serving. Both are idempotent,
# so restarts are safe.
set -e

echo "[entrypoint] alembic upgrade head"
alembic upgrade head

echo "[entrypoint] seeding reference data"
python -m app.seed

echo "[entrypoint] starting: $*"
exec "$@"
