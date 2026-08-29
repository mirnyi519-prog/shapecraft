#!/bin/bash
# Починить 502 на shapecraft.ru: снова связать Caddy ↔ ShapeCraft
set -euo pipefail

DOMAIN=shapecraft.ru
CADDY=bridge-caddy-1
APP=shapecraft-shapecraft-1
CADDYFILE=/home/deploy/bridge/Caddyfile

echo "==> App status"
docker ps --filter "name=$APP" --format '{{.Names}} {{.Status}} {{.Ports}}'
curl -s -o /dev/null -w "localhost:3000 -> %{http_code}\n" http://127.0.0.1:3000 || true

echo "==> Connect app to Caddy network"
NET=$(docker inspect "$CADDY" --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}' | awk '{print $1}')
echo "network=$NET"
docker network connect "$NET" "$APP" 2>/dev/null || true

# Проверяем, резолвится ли имя из Caddy
if docker exec "$CADDY" wget -q -O /dev/null "http://$APP:3000" 2>/dev/null \
  || docker exec "$CADDY" sh -c "wget -q -O /dev/null http://$APP:3000" 2>/dev/null; then
  UPSTREAM="$APP:3000"
else
  # fallback: IP шлюза docker bridge (хост)
  GATEWAY=$(docker network inspect "$NET" --format '{{(index .IPAM.Config 0).Gateway}}' 2>/dev/null || echo "172.17.0.1")
  UPSTREAM="${GATEWAY}:3000"
  echo "==> Container DNS from Caddy failed, using host gateway $UPSTREAM"
fi

echo "==> Upstream: $UPSTREAM"
cp "$CADDYFILE" "${CADDYFILE}.bak.$(date +%s)"

# Заменяем/добавляем блок домена (HTTP+HTTPS через авто Caddy)
python3 - <<PY
from pathlib import Path
import re
path = Path("$CADDYFILE")
text = path.read_text(encoding="utf-8")
domain = "$DOMAIN"
upstream = "$UPSTREAM"
# убрать старые блоки shapecraft
text = re.sub(r"(?ms)^https?://[^\n]*shapecraft\.ru[^\n]*\{.*?^\}\s*", "", text)
text = re.sub(r"(?ms)^[^\n]*shapecraft\.ru[^\n]*\{.*?^\}\s*", "", text)
block = f"""{domain}, www.{domain} {{
\tencode gzip
\treverse_proxy {upstream}
}}
"""
path.write_text(text.rstrip() + "\n\n" + block + "\n", encoding="utf-8")
print(block)
PY

echo "==> Reload Caddy"
docker exec "$CADDY" caddy reload --config /etc/caddy/Caddyfile

sleep 2
echo "==> Checks"
curl -s -o /dev/null -w "Host http  -> %{http_code}\n" -H "Host: $DOMAIN" http://127.0.0.1/ || true
curl -k -s -o /dev/null -w "Host https -> %{http_code}\n" -H "Host: $DOMAIN" https://127.0.0.1/ || true

echo "Done. Open https://$DOMAIN (если VPN — отключите или пропишите hosts)"
