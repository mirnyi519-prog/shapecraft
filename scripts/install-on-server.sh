#!/bin/bash
# ShapeCraft — установка на сервер Timeweb одной командой.
# В консоли Fair Amalthea (VNC) выполните:
#   curl -fsSL https://raw.githubusercontent.com/mirnyi519-prog/shapecraft/master/scripts/install-on-server.sh | bash

set -euo pipefail

REPO="${SHAPECRAFT_REPO:-https://github.com/mirnyi519-prog/shapecraft.git}"
DIR="${SHAPECRAFT_DIR:-/opt/shapecraft}"
DOMAIN="${SHAPECRAFT_DOMAIN:-shapecraft.ru}"

echo "==> ShapeCraft install"

if ! command -v docker >/dev/null 2>&1; then
  echo "==> Installing Docker..."
  curl -fsSL https://get.docker.com | sh
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose plugin not found. Install Docker from get.docker.com first."
  exit 1
fi

if [ -d "$DIR/.git" ]; then
  echo "==> Updating repo..."
  git -C "$DIR" pull --ff-only
else
  echo "==> Cloning repo..."
  mkdir -p "$(dirname "$DIR")"
  git clone "$REPO" "$DIR"
fi

cd "$DIR"

if [ ! -f .env ]; then
  echo "==> Creating .env..."
  cp .env.example .env
  AUTH=$(openssl rand -hex 24 2>/dev/null || head -c 32 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c 32)
  sed -i "s/change-me-to-random-string/$AUTH/" .env
  echo ""
  echo "ВАЖНО: отредактируйте пароли в $DIR/.env"
  echo "  nano $DIR/.env"
  echo ""
fi

echo "==> Building and starting..."
docker compose up -d --build

echo ""
echo "==> App started on http://127.0.0.1:3000"
echo "    Test: curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000"

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

echo ""
echo "==> Done."
echo "    Site: http://$DOMAIN"
echo "    HTTPS: certbot --nginx -d $DOMAIN -d www.$DOMAIN"
echo "    Login: admin / пароль из $DIR/.env (OWNER_PASSWORD)"
