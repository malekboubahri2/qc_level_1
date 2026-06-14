# Dev container image. Declares the Python side of the toolchain so it is
# identical on every machine and in CI (dev-environment.md). uv is taken from
# the same official image the server's deploy Dockerfile uses, so dev and deploy
# resolve Python dependencies with the exact same tool — no drift.
FROM mcr.microsoft.com/devcontainers/python:1-3.11-bookworm

# The base image ships a yarn apt source whose signing key has expired, which
# breaks `apt-get update` — and therefore any feature that installs via apt
# (e.g. docker-outside-of-docker). We use pnpm via corepack, not yarn, so drop
# the broken source. This runs before features, so their apt-get update is clean.
RUN rm -f /etc/apt/sources.list.d/yarn.list

# uv / uvx (Python package manager). Pinned image, copied — not curl-installed.
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/

# Node 22 + Docker CLI are added as devcontainer features (see devcontainer.json);
# pnpm is provided by corepack (Node) and pinned via package.json's
# packageManager field. post-create.sh only installs *project* dependencies.
