#!/bin/bash
# Привязка shapecraft.ru к ShapeCraft через Docker Caddy (bridge-caddy-1).
set -euo pipefail

DOMAIN="${SHAPECRAFT_DOMAIN:-shapecraft.ru}"
CADDY_NAME="${CADDY_CONTAINER:-bridge-caddy-1}"
APP_NAME="${APP_CONTAINER:-shapecraft-shapecraft-1}"

echo "==> Checking containers..."
docker ps --format '{{.Names}}' | grep -qx "$CADDY_NAME" || { echo "Caddy container $CADDY_NAME not found"; exit 1; }
docker ps --format '{{.Names}}' | grep -qx "$APP_NAME" || { echo "App container $APP_NAME not found"; exit 1; }

echo "==> Finding Caddyfile mount..."
MOUNT_INFO=$(docker inspect "$CADDY_NAME" --format '{{range .Mounts}}{{.Source}}|{{.Destination}}{{println}}{{end}}')
echo "$MOUNT_INFO"

CADDYFILE=""
while IFS='|' read -r src dst; do
  [ -z "${src:-}" ] && continue
  if [ -f "$src" ] && [[ "$dst" == *Caddyfile* || "$(basename "$src")" == "Caddyfile" ]]; then
    CADDYFILE="$src"
    break
  fi
  if [ -d "$src" ]; then
    if [ -f "$src/Caddyfile" ]; then
      CADDYFILE="$src/Caddyfile"
      break
    fi
  fi
done <<< "$MOUNT_INFO"

if [ -z "$CADDYFILE" ]; then
  # поиск рядом с compose bridge
  for cand in \
    /opt/bridge/Caddyfile \
    /root/bridge/Caddyfile \
    /var/lib/bridge/Caddyfile \
    /opt/*/Caddyfile \
    /root/*/Caddyfile
  do
    if [ -f $cand ]; then
      CADDYFILE=$(ls $cand | head -n1)
      break
    fi
  done
fi

if [ -z "$CADDYFILE" ]; then
  echo "Caddyfile not found on host. Searching..."
  find /root /opt /home /var/www /srv -name 'Caddyfile' 2>/dev/null | head -n 20
  echo ""
  echo "Run and send output:"
  echo "  docker inspect $CADDY_NAME"
  exit 1
fi

echo "==> Caddyfile: $CADDYFILE"
cp "$CADDYFILE" "${CADDYFILE}.bak.$(date +%s)"

# Подключаем ShapeCraft к той же сети, что и Caddy
NET=$(docker inspect "$CADDY_NAME" --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{end}}' | awk '{print $1}')
echo "==> Caddy network: $NET"
if [ -n "$NET" ]; then
  docker network connect "$NET" "$APP_NAME" 2>/dev/null || true
fi

# Удаляем старый блок домена и добавляем новый
TMP=$(mktemp)
python3 - "$CADDYFILE" "$DOMAIN" "$APP_NAME" "$TMP" <<'PY'
import re, sys
path, domain, app, out = sys.argv[1:5]
text = open(path, encoding="utf-8").read()
text = re.sub(
    rf"(?ms)^[^\n]*{re.escape(domain)}[^\n]*\{{.*?^\}}\s*",
    "",
    text,
)
block = f"""{domain}, www.{domain} {{
\tencode gzip
\treverse_proxy {app}:3000
}}
"""
text = text.rstrip() + "\n\n" + block + "\n"
open(out, "w", encoding="utf-8").write(text)
print("updated")
PY
mv "$TMP" "$CADDYFILE"

echo "==> New site block:"
grep -A5 "$DOMAIN" "$CADDYFILE" || true

echo "==> Reloading Caddy..."
docker exec "$CADDY_NAME" caddy reload --config /etc/caddy/Caddyfile 2>/dev/null \
  || docker exec "$CADDY_NAME" caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile 2>/dev/null \
  || docker restart "$CADDY_NAME"

sleep 2
echo "==> Local check via Host header:"
curl -s -o /dev/null -w "http://127.0.0.1 Host=$DOMAIN -> %{http_code}\n" -H "Host: $DOMAIN" http://127.0.0.1/ || true

echo ""
echo "==> Done. Open http://$DOMAIN"
echo "    Fallback: http://SERVER_IP:3000"
echo "    Login: admin / shapecraft123"
