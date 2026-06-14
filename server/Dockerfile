# ── Build: resolve deps into a venv with uv ───────────────────────────────
FROM python:3.11-slim AS build

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/app/.venv

# Only the dependency manifests first — keeps this layer cached across code edits.
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen

# ── Runtime: slim image, non-root, migrations+seed on start ───────────────
FROM python:3.11-slim AS runtime

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/app/.venv/bin:$PATH"

# Fixed-UID app user. /data is owned by it so a fresh named volume mounted there
# inherits writable ownership (Docker seeds empty volumes from the image dir).
RUN useradd --create-home --uid 1000 appuser \
    && mkdir -p /data \
    && chown appuser:appuser /data

WORKDIR /app
COPY --from=build /app/.venv /app/.venv
COPY app ./app
COPY migrations ./migrations
COPY alembic.ini ./
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

USER appuser
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8000/health').status==200 else 1)"

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
