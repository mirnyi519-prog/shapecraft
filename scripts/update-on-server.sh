#!/bin/bash
# Обновление ShapeCraft без лишних pull с Docker Hub + починка Caddy
set -euo pipefail

cd /opt/shapecraft
git fetch origin
git reset --hard origin/master

echo "==> Build (без скачивания базового образа)"
docker compose build --pull=false
docker compose up -d --force-recreate

echo "==> Fix Caddy proxy"
curl -fsSL https://raw.githubusercontent.com/mirnyi519-prog/shapecraft/master/scripts/fix-shapecraft-proxy.sh | bash

echo "==> Done"
curl -s -o /dev/null -w "app :3000 -> %{http_code}\n" http://127.0.0.1:3000 || true
