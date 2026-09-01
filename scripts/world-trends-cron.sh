#!/bin/bash
# Еженедельный запуск бота «В мире» (добавить в crontab на сервере).
# Пример: 0 9 * * 1 /opt/shapecraft/scripts/world-trends-cron.sh >> /var/log/shapecraft-world.log 2>&1

set -euo pipefail

DIR="${SHAPECRAFT_DIR:-/opt/shapecraft}"
ENV_FILE="$DIR/.env"

if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

if [ -z "${CRON_SECRET:-}" ]; then
  echo "CRON_SECRET is not set in $ENV_FILE"
  exit 1
fi

curl -fsS -X POST "http://127.0.0.1:3000/api/world/generate" \
  -H "x-cron-secret: ${CRON_SECRET}" \
  -H "Content-Type: application/json"

echo ""
echo "World trends bot finished at $(date -Is)"
