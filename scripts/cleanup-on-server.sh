#!/bin/bash
# Чистка диска на VPS: старые Docker-образы и build-кэш.
# Volumes (БД, uploads) НЕ трогаем.
#
# Использование:
#   bash /opt/shapecraft/scripts/cleanup-on-server.sh
#   bash /opt/shapecraft/scripts/cleanup-on-server.sh --aggressive
set -euo pipefail

AGGRESSIVE=0
if [ "${1:-}" = "--aggressive" ] || [ "${1:-}" = "-a" ]; then
  AGGRESSIVE=1
fi

echo "==> Disk before"
df -h / | sed -n '1,2p' || true
docker system df 2>/dev/null || true
echo

echo "==> Prune stopped containers / dangling images / unused networks"
docker container prune -f >/dev/null || true
docker network prune -f >/dev/null || true
docker image prune -f >/dev/null || true

echo "==> Prune build cache"
docker builder prune -af >/dev/null || true

if [ "$AGGRESSIVE" -eq 1 ]; then
  echo "==> Aggressive: remove ALL unused images (not just dangling)"
  # Не удаляет образы, которые сейчас использует running-контейнер
  docker image prune -af >/dev/null || true
  docker system prune -af >/dev/null || true
else
  echo "==> Soft: remove unused images older than 24h"
  docker image prune -af --filter "until=24h" >/dev/null || true
  docker system prune -af --filter "until=24h" >/dev/null || true
fi

# Урезаем раздутые json-логи контейнеров (>50 МБ), сами контейнеры не трогаем
echo "==> Truncate oversized container logs (>50M)"
if command -v docker >/dev/null 2>&1; then
  while IFS= read -r id; do
    [ -z "$id" ] && continue
    log_path="$(docker inspect --format='{{.LogPath}}' "$id" 2>/dev/null || true)"
    if [ -n "$log_path" ] && [ -f "$log_path" ]; then
      size="$(stat -c%s "$log_path" 2>/dev/null || echo 0)"
      if [ "${size:-0}" -gt $((50 * 1024 * 1024)) ]; then
        echo "    truncate $(basename "$log_path") ($(numfmt --to=iec "$size" 2>/dev/null || echo "${size}B"))"
        : > "$log_path" || true
      fi
    fi
  done < <(docker ps -aq 2>/dev/null || true)
fi

echo
echo "==> Disk after"
df -h / | sed -n '1,2p' || true
docker system df 2>/dev/null || true
echo
echo "==> Cleanup done (volumes preserved)"
