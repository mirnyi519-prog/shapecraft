#!/bin/bash
# Еженедельная синхронизация «В мире» с GitHub на сервере.
set -euo pipefail

cd /opt/shapecraft

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

if [ -z "${WORLD_IMPORT_SECRET:-}" ]; then
  echo "WORLD_IMPORT_SECRET не задан в /opt/shapecraft/.env" >&2
  exit 1
fi

BASE_URL="${WORLD_PUBLISH_URL:-https://shapecraft.ru/api/world/import}"
BASE_URL="${BASE_URL%/api/world/import}"

curl -fsSL -X POST \
  -H "Authorization: Bearer ${WORLD_IMPORT_SECRET}" \
  -H "Content-Type: application/json" \
  -d '{"force":true}' \
  "${BASE_URL}/api/world/sync"

echo ""
echo "==> World trends sync done"
