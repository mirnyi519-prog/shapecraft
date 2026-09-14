#!/bin/bash
# Починить 502 на shapecraft.ru: снова связать Caddy ↔ ShapeCraft
set -euo pipefail

DOMAIN=shapecraft.ru
CADDY=bridge-caddy-1
APP=shapecraft-shapecraft-1
CADDYFILE=/home/deploy/bridge/Caddyfile

echo "==> Allow docker -> host ports"
bash /opt/shapecraft/scripts/allow-docker-to-host.sh 2>/dev/null \
  || bash "$(dirname "$0")/allow-docker-to-host.sh" 2>/dev/null \
  || true

echo "==> App status"
docker ps --filter "name=$APP" --format '{{.Names}} {{.Status}} {{.Ports}}'
curl -s -o /dev/null -w "localhost:3000 -> %{http_code}\n" http://127.0.0.1:3000 || true

NET=$(docker inspect "$CADDY" --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}' | awk '{print $1}')
echo "network=$NET"

NETMODE=$(docker inspect "$APP" --format '{{.HostConfig.NetworkMode}}' 2>/dev/null || echo "bridge")
echo "app network_mode=$NETMODE"

pick_upstream() {
  local candidate
  local gateway
  gateway=$(docker network inspect "$NET" --format '{{(index .IPAM.Config 0).Gateway}}' 2>/dev/null || true)

  local candidates=()
  if [ "$NETMODE" = "host" ]; then
    candidates+=("${gateway:-}" "172.17.0.1" "172.18.0.1" "172.19.0.1" "172.20.0.1")
  else
    docker network connect "$NET" "$APP" 2>/dev/null || true
    candidates+=("$APP" "${gateway:-}" "172.17.0.1" "172.18.0.1")
  fi

  for candidate in "${candidates[@]}"; do
    [ -n "$candidate" ] || continue
    if docker exec "$CADDY" wget -q -O /dev/null --timeout=2 "http://${candidate}:3000" 2>/dev/null \
      || docker exec "$CADDY" sh -c "wget -q -O /dev/null -T 2 http://${candidate}:3000" 2>/dev/null; then
      echo "${candidate}:3000"
      return 0
    fi
  done
  return 1
}

UPSTREAM="$(pick_upstream || true)"
if [ -z "${UPSTREAM:-}" ]; then
  GATEWAY=$(docker network inspect "$NET" --format '{{(index .IPAM.Config 0).Gateway}}' 2>/dev/null || echo "172.17.0.1")
  UPSTREAM="${GATEWAY}:3000"
  echo "==> No probed upstream worked, fallback $UPSTREAM"
fi

echo "==> Upstream: $UPSTREAM"
cp "$CADDYFILE" "${CADDYFILE}.bak.$(date +%s)"

python3 - <<PY
from pathlib import Path
import re
path = Path("$CADDYFILE")
text = path.read_text(encoding="utf-8")
domain = "$DOMAIN"
upstream = "$UPSTREAM"
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
curl -s -o /dev/null -w "App  :3000 -> %{http_code}\n" http://127.0.0.1:3000 || true
curl -s -o /dev/null -w "Host http  -> %{http_code}\n" -H "Host: $DOMAIN" http://127.0.0.1/ || true
curl -k -s -o /dev/null -w "Host https -> %{http_code}\n" -H "Host: $DOMAIN" https://127.0.0.1/ || true

echo "Done. Open https://$DOMAIN"
