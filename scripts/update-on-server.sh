#!/bin/bash
# Обновление ShapeCraft: обход лимита Docker Hub + починка Caddy
set -euo pipefail

cd /opt/shapecraft
git fetch origin
git reset --hard origin/master

# Берём уже скачанный node-образ по ID — без запросов к registry
BASE_IMAGE="mirror.gcr.io/library/node:22-bookworm-slim"
if docker image inspect node:22-bookworm-slim >/dev/null 2>&1; then
  BASE_IMAGE=$(docker image inspect node:22-bookworm-slim --format '{{.Id}}')
  echo "==> Using local node image: $BASE_IMAGE"
elif docker image inspect mirror.gcr.io/library/node:22-bookworm-slim >/dev/null 2>&1; then
  BASE_IMAGE=$(docker image inspect mirror.gcr.io/library/node:22-bookworm-slim --format '{{.Id}}')
  echo "==> Using local mirror image: $BASE_IMAGE"
else
  echo "==> Local node image not found, will try Google mirror (not Docker Hub)"
fi

echo "==> Building..."
export DOCKER_BUILDKIT=0
export COMPOSE_DOCKER_CLI_BUILD=0
docker compose build --pull=false --build-arg "BASE_IMAGE=${BASE_IMAGE}"
docker compose up -d --force-recreate

echo "==> Fix Caddy proxy"
curl -fsSL https://raw.githubusercontent.com/mirnyi519-prog/shapecraft/master/scripts/fix-shapecraft-proxy.sh | bash

echo "==> Done"
curl -s -o /dev/null -w "app :3000 -> %{http_code}\n" http://127.0.0.1:3000 || true
