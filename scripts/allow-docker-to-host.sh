#!/bin/bash
# Разрешить контейнерам Docker достучаться до портов на хосте.
# Без этого Caddy/app часто получают Connect Timeout на 172.17.0.1:PORT.
set -euo pipefail

allow_port() {
  local port="$1"
  local iface
  for iface in docker0 $(ip -o link show | awk -F': ' '{print $2}' | grep -E '^br-' || true); do
    [ -n "$iface" ] || continue
    if ! iptables -C INPUT -i "$iface" -p tcp --dport "$port" -j ACCEPT 2>/dev/null; then
      iptables -I INPUT -i "$iface" -p tcp --dport "$port" -j ACCEPT
      echo "==> iptables: allow $iface -> :$port"
    fi
  done
}

if ! command -v iptables >/dev/null 2>&1; then
  echo "==> iptables not found, skip"
  exit 0
fi

allow_port 3000
allow_port 3098

echo "==> docker->host ports ready"
