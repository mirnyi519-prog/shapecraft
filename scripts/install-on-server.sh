#!/bin/bash
# ShapeCraft — установка на сервер Timeweb одной командой.
# В консоли Fair Amalthea (VNC) выполните:
#   curl -fsSL https://raw.githubusercontent.com/mirnyi519-prog/shapecraft/master/scripts/install-on-server.sh | bash

set -euo pipefail

REPO="${SHAPECRAFT_REPO:-https://github.com/mirnyi519-prog/shapecraft.git}"
DIR="${SHAPECRAFT_DIR:-/opt/shapecraft}"
DOMAIN="${SHAPECRAFT_DOMAIN:-shapecraft.ru}"

if [ -n "${GITHUB_TOKEN:-}" ]; then
  REPO="https://${GITHUB_TOKEN}@github.com/mirnyi519-prog/shapecraft.git"
fi

echo "==> ShapeCraft install"

if ! command -v docker >/dev/null 2>&1; then
  echo "==> Installing Docker..."
  curl -fsSL https://get.docker.com | sh
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose plugin not found. Install Docker from get.docker.com first."
  exit 1
fi

if ! command -v git >/dev/null 2>&1; then
  apt-get update -y
  apt-get install -y git
fi

if [ -d "$DIR/.git" ]; then
  echo "==> Updating repo..."
  git -C "$DIR" fetch origin
  git -C "$DIR" reset --hard origin/master
else
  echo "==> Cloning repo..."
  mkdir -p "$(dirname "$DIR")"
  git clone "$REPO" "$DIR"
fi

cd "$DIR"

if [ ! -f .env ]; then
  echo "==> Creating .env..."
  AUTH=$(openssl rand -hex 24 2>/dev/null || head -c 32 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c 32)
  cat > .env <<EOF
AUTH_SECRET=$AUTH
OWNER_LOGIN=admin
OWNER_PASSWORD=shapecraft123
PARTNER_LOGIN=partner
PARTNER_PASSWORD=shapecraft123
COOKIE_SECURE=false
EOF
  echo ""
  echo "Логин: admin / shapecraft123"
  echo "Пароли можно сменить: nano $DIR/.env"
  echo ""
else
  # если старый .env с your-password — поправим на дефолт
  if grep -q 'OWNER_PASSWORD=your-password' .env 2>/dev/null; then
    sed -i 's/OWNER_PASSWORD=your-password/OWNER_PASSWORD=shapecraft123/' .env
  fi
  if grep -q 'PARTNER_PASSWORD=partner-password' .env 2>/dev/null; then
    sed -i 's/PARTNER_PASSWORD=partner-password/PARTNER_PASSWORD=shapecraft123/' .env
  fi
  if ! grep -q 'COOKIE_SECURE=' .env 2>/dev/null; then
    echo 'COOKIE_SECURE=false' >> .env
  fi
fi

echo "==> Building and starting..."
docker compose up -d --build

echo ""
echo "==> Waiting for app..."
for i in 1 2 3 4 5 6 7 8 9 10; do
  code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000 || true)
  if [ "$code" = "200" ] || [ "$code" = "307" ] || [ "$code" = "302" ]; then
    echo "    App OK (HTTP $code)"
    break
  fi
  sleep 3
done

# На Timeweb часто уже стоит Caddy — используем его, иначе nginx
if command -v caddy >/dev/null 2>&1 || [ -d /etc/caddy ]; then
  echo "==> Configuring Caddy for $DOMAIN..."
  CADDY_DIR="/etc/caddy"
  mkdir -p "$CADDY_DIR"
  cat > "$CADDY_DIR/shapecraft.caddy" <<EOF
$DOMAIN, www.$DOMAIN {
  encode gzip
  reverse_proxy 127.0.0.1:3000
}
EOF
  if [ -f "$CADDY_DIR/Caddyfile" ] && ! grep -q "$DOMAIN" "$CADDY_DIR/Caddyfile" 2>/dev/null; then
    echo "import shapecraft.caddy" >> "$CADDY_DIR/Caddyfile"
  elif [ ! -f "$CADDY_DIR/Caddyfile" ]; then
    echo "import shapecraft.caddy" > "$CADDY_DIR/Caddyfile"
  fi
  systemctl reload caddy 2>/dev/null || caddy reload --config "$CADDY_DIR/Caddyfile" 2>/dev/null || true
  echo "    Caddy config written. If site still 404, add reverse_proxy in panel / main Caddyfile."
else
  if ! command -v nginx >/dev/null 2>&1; then
    echo "==> Installing nginx + certbot..."
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -y
    apt-get install -y nginx certbot python3-certbot-nginx
  fi

  NGINX_CONF="/etc/nginx/sites-available/$DOMAIN"
  if [ ! -f "$NGINX_CONF" ]; then
    echo "==> Configuring nginx for $DOMAIN..."
    cat > "$NGINX_CONF" <<EOF
server {
  listen 80;
  server_name $DOMAIN www.$DOMAIN;

  client_max_body_size 20M;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
EOF
    ln -sf "$NGINX_CONF" "/etc/nginx/sites-enabled/$DOMAIN"
    rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
    nginx -t
    systemctl enable nginx
    systemctl reload nginx
  fi
fi

echo ""
echo "==> Done."
echo "    Local:  http://127.0.0.1:3000"
echo "    Public: http://$DOMAIN  or  http://SERVER_IP:3000"
echo "    Login:  admin / пароль из $DIR/.env (OWNER_PASSWORD, по умолчанию shapecraft123)"
