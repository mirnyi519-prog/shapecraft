#!/bin/bash
# Снимок боевого сайта: база, фото, .env. Печатает BACKUP_PATH=... в stdout.
# Папку архива задаёт BACKUP_DIR (по умолчанию /tmp).
set -euo pipefail

cd /opt/shapecraft
STAMP=$(date +%Y%m%d-%H%M%S)
OUT_DIR="${BACKUP_DIR:-/tmp}"
mkdir -p "$OUT_DIR"
WORKDIR=$(mktemp -d /tmp/shapecraft-backup.XXXXXX)
OUT="${OUT_DIR}/shapecraft-${STAMP}.tar.gz"
CID=$(docker compose ps -q shapecraft)

if [ -z "$CID" ]; then
  echo "Контейнер shapecraft не запущен" >&2
  exit 1
fi

unpause() {
  docker compose unpause shapecraft >/dev/null 2>&1 || true
}
trap unpause EXIT

echo "==> Короткая пауза, чтобы база скопировалась целиком" >&2
docker compose pause shapecraft
docker cp "$CID:/app/data/prod.db" "$WORKDIR/prod.db"
docker cp "$CID:/app/data/prod.db-wal" "$WORKDIR/prod.db-wal" 2>/dev/null || true
docker cp "$CID:/app/data/prod.db-shm" "$WORKDIR/prod.db-shm" 2>/dev/null || true
docker compose unpause shapecraft
trap - EXIT

echo "==> Фото" >&2
mkdir -p "$WORKDIR/uploads"
docker cp "$CID:/app/public/uploads/." "$WORKDIR/uploads/"

cp /opt/shapecraft/.env "$WORKDIR/site.env"
git -C /opt/shapecraft rev-parse HEAD > "$WORKDIR/git-rev.txt"
date -Iseconds > "$WORKDIR/created-at.txt"

tar -C "$WORKDIR" -czf "$OUT" .
rm -rf "$WORKDIR"
echo "BACKUP_PATH=${OUT}"
