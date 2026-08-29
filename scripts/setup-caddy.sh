#!/bin/bash
# Привязка shapecraft.ru к приложению через Caddy (порт 80 уже занят Caddy, не nginx).
# Запуск на сервере:
#   bash /opt/shapecraft/scripts/setup-caddy.sh
# или:
#   curl -fsSL https://raw.githubusercontent.com/mirnyi519-prog/shapecraft/master/scripts/setup-caddy.sh | bash

set -euo pipefail

DOMAIN="${SHAPECRAFT_DOMAIN:-shapecraft.ru}"
APP="127.0.0.1:3000"

echo "==> Checking app on $APP..."
code=$(curl -s -o /dev/null -w '%{http_code}' "http://$APP" || true)
echo "    HTTP $code"
if [ "$code" != "200" ] && [ "$code" != "307" ] && [ "$code" != "302" ]; then
  echo "App is not responding on :3000. Start it first:"
  echo "  cd /opt/shapecraft && docker compose up -d"
  exit 1
fi

echo "==> Stopping nginx (port 80 is used by Caddy)..."
systemctl stop nginx 2>/dev/null || true
systemctl disable nginx 2>/dev/null || true

# Ищем, как установлен Caddy
CADDYFILE=""
for path in /etc/caddy/Caddyfile /etc/Caddyfile /usr/local/etc/caddy/Caddyfile; do
  if [ -f "$path" ]; then
    CADDYFILE="$path"
    break
  fi
done

# Timeweb / docker caddy
if [ -z "$CADDYFILE" ]; then
  if docker ps --format '{{.Names}}' 2>/dev/null | grep -qi caddy; then
    CNAME=$(docker ps --format '{{.Names}}' | grep -i caddy | head -n1)
    echo "==> Found Caddy container: $CNAME"
    echo "==> Writing temporary Caddy snippet..."
    SNIP="/tmp/shapecraft-caddy.conf"
    cat > "$SNIP" <<EOF
$DOMAIN, www.$DOMAIN {
  encode gzip
  reverse_proxy $APP
}
EOF
    echo "Container Caddy detected. Paste this into your Caddyfile for $CNAME:"
    cat "$SNIP"
    echo ""
    echo "Or run (if volume-mounted Caddyfile exists):"
    docker inspect "$CNAME" --format '{{range .Mounts}}{{.Source}} -> {{.Destination}}{{println}}{{end}}'
    exit 0
  fi
fi

if [ -z "$CADDYFILE" ]; then
  echo "==> No system Caddyfile found. Who owns port 80?"
  ss -tlnp | grep ':80 ' || netstat -tlnp 2>/dev/null | grep ':80 ' || true
  echo ""
  echo "App is available now at: http://SERVER_IP:3000"
  echo "Open firewall/security group for 3000, or configure reverse proxy manually."
  exit 0
fi

echo "==> Using Caddyfile: $CADDYFILE"
BACKUP="${CADDYFILE}.bak.$(date +%s)"
cp "$CADDYFILE" "$BACKUP"
echo "    Backup: $BACKUP"

# Удаляем старый блок домена, если был
python3 - <<'PY' "$CADDYFILE" "$DOMAIN" "$APP" || true
import sys
path, domain, app = sys.argv[1], sys.argv[2], sys.argv[3]
text = open(path, encoding="utf-8").read()
# naive strip of previous shapecraft block
import re
text = re.sub(
    rf"(?ms)^{re.escape(domain)}(?:,\s*www\.{re.escape(domain)})?\s*\{{.*?^\}}\s*",
    "",
    text,
)
block = f"""{domain}, www.{domain} {{
\tencode gzip
\treverse_proxy {app}
}}
"""
if domain not in text:
    text = text.rstrip() + "\n\n" + block + "\n"
open(path, "w", encoding="utf-8").write(text)
print("Caddyfile updated")
PY

# Fallback append if python failed to add
if ! grep -q "$DOMAIN" "$CADDYFILE"; then
  cat >> "$CADDYFILE" <<EOF

$DOMAIN, www.$DOMAIN {
  encode gzip
  reverse_proxy $APP
}
EOF
fi

echo "==> Reloading Caddy..."
if systemctl is-active --quiet caddy 2>/dev/null; then
  caddy validate --config "$CADDYFILE"
  systemctl reload caddy
elif command -v caddy >/dev/null 2>&1; then
  caddy reload --config "$CADDYFILE"
else
  echo "Could not reload Caddy automatically."
fi

echo ""
echo "==> Done."
echo "    http://$DOMAIN"
echo "    http://SERVER_IP:3000"
echo "    Login: admin / shapecraft123 (or OWNER_PASSWORD in /opt/shapecraft/.env)"
