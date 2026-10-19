#!/bin/bash
# Ночной бэкап на сервере: архив в /opt/shapecraft-backups, хранятся последние KEEP штук.
#   bash scripts/backup-nightly.sh            — сделать бэкап сейчас
#   bash scripts/backup-nightly.sh --install  — поставить ежедневный запуск в 03:30
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/opt/shapecraft-backups}"
KEEP="${KEEP:-7}"
CRON_FILE=/etc/cron.d/shapecraft-backup
LOG_FILE=/var/log/shapecraft-backup.log

if [ "${1:-}" = "--install" ]; then
  cat > "$CRON_FILE" <<EOF
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
30 3 * * * root bash /opt/shapecraft/scripts/backup-nightly.sh >> ${LOG_FILE} 2>&1
EOF
  chmod 644 "$CRON_FILE"
  echo "==> Ночной бэкап включён: ${CRON_FILE}, лог ${LOG_FILE}"
  exit 0
fi

echo "==> $(date -Iseconds) бэкап в ${BACKUP_DIR}"
BACKUP_DIR="$BACKUP_DIR" bash /opt/shapecraft/scripts/backup-on-server.sh

ls -1t "$BACKUP_DIR"/shapecraft-*.tar.gz 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f
ls -lh "$BACKUP_DIR" | tail -n +2
df -h / | sed -n '2p'
