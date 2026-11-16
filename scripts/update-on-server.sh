#!/bin/bash
# Обновление ShapeCraft: обход лимита Docker Hub + починка Caddy
set -euo pipefail

cd /opt/shapecraft
git fetch origin
git reset --hard origin/master

# HTTPS-сайт: сессионные cookie только по Secure
if [ -f .env ]; then
  if ! grep -q 'COOKIE_SECURE=' .env 2>/dev/null; then
    echo 'COOKIE_SECURE=true' >> .env
    echo "==> Added COOKIE_SECURE=true to .env"
  elif grep -qE '^COOKIE_SECURE=(false|0|"false")$' .env 2>/dev/null; then
    sed -i 's/^COOKIE_SECURE=.*/COOKIE_SECURE=true/' .env
    echo "==> COOKIE_SECURE=true (was false)"
  fi
fi

echo "==> Backup before update"
bash scripts/backup-nightly.sh || echo "!! Бэкап не получился — обновление продолжается"
bash scripts/backup-nightly.sh --install || true

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
export BASE_IMAGE

echo "==> Building..."
export DOCKER_BUILDKIT=0
export COMPOSE_DOCKER_CLI_BUILD=0
docker compose build --pull=false --build-arg "BASE_IMAGE=${BASE_IMAGE}"
docker compose up -d --force-recreate --remove-orphans

echo "==> Optimize existing product photos"
docker compose exec -T shapecraft npx tsx scripts/optimize-uploads.ts || true

echo "==> Allow docker -> host (for Caddy)"
bash scripts/allow-docker-to-host.sh || true

echo "==> Fix Caddy proxy"
curl -fsSL https://raw.githubusercontent.com/mirnyi519-prog/shapecraft/master/scripts/fix-shapecraft-proxy.sh | bash

echo "==> Cleanup unused Docker images/cache"
bash scripts/cleanup-on-server.sh --aggressive || true

echo "==> Done"
curl -s -o /dev/null -w "app :3000 -> %{http_code}\n" http://127.0.0.1:3000 || true
df -h / | sed -n '1,2p' || true
