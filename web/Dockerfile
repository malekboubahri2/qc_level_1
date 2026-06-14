# ── Build: compile the SPA with pnpm ──────────────────────────────────────
FROM node:22-alpine AS build

WORKDIR /app
RUN corepack enable

# Manifests first for layer caching.
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# ── Runtime: Caddy serves the static bundle + proxies /api + TLS ──────────
FROM caddy:2-alpine AS runtime

COPY --from=build /app/dist /srv
COPY Caddyfile /etc/caddy/Caddyfile

EXPOSE 80 443
