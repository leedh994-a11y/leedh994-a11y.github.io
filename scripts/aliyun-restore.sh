#!/usr/bin/env bash
# Emergency restore for https://yoursite.asia (502 Bad Gateway)
# Run on Alibaba server as root:
#   curl -fsSL https://raw.githubusercontent.com/leedh994-a11y/leedh994-a11y.github.io/cursor/yoursite-order-notify-fd54/scripts/aliyun-restore.sh | bash

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/sitegpt}"
PORT="${PORT:-}"

log() { echo "[restore] $*"; }

detect_nginx_port() {
  local p
  p="$(grep -r "proxy_pass" /etc/nginx/ 2>/dev/null | grep -oE ':[0-9]+' | head -1 | tr -d ':' || true)"
  if [ -n "$p" ]; then
    echo "$p"
    return
  fi
  echo "3000"
}

pick_entry() {
  if [ -f "$APP_DIR/server.js" ]; then
    echo "$APP_DIR/server.js"
    return
  fi
  if [ -f "$APP_DIR/server/index.js" ]; then
    echo "$APP_DIR/server/index.js"
    return
  fi
  echo ""
}

try_health() {
  local port="$1"
  curl -sf "http://127.0.0.1:${port}/api/health" >/dev/null 2>&1
}

start_pm2() {
  local script="$1"
  local port="$2"
  log "Start sitegpt: $script on port $port"
  cd "$APP_DIR"
  if [ -f .env ]; then
    if grep -q '^PORT=' .env; then
      sed -i "s/^PORT=.*/PORT=${port}/" .env
    else
      echo "PORT=${port}" >> .env
    fi
  else
    echo "PORT=${port}" > .env
  fi
  export PORT="$port"
  pm2 delete sitegpt 2>/dev/null || true
  pm2 start "$script" --name sitegpt --cwd "$APP_DIR" --update-env
  pm2 save
  sleep 2
}

main() {
  [ "$(id -u)" -eq 0 ] || { echo "Run as root"; exit 1; }
  command -v pm2 >/dev/null 2>&1 || npm install -g pm2

  [ -d "$APP_DIR" ] || { echo "Missing $APP_DIR"; exit 1; }

  local entry nginx_port port
  entry="$(pick_entry)"
  [ -n "$entry" ] || { echo "No server.js or server/index.js in $APP_DIR"; exit 1; }

  nginx_port="$(detect_nginx_port)"
  log "Nginx proxy port hint: $nginx_port"

  for port in "${PORT:-}" "$nginx_port" 3000 3456 8080; do
    [ -n "$port" ] || continue
    start_pm2 "$entry" "$port"
    if try_health "$port"; then
      log "OK: backend healthy on port $port"
      curl -s "http://127.0.0.1:${port}/api/health" || true
      echo ""
      log "Test public URL:"
      curl -s -o /dev/null -w "yoursite.asia HTTP %{http_code}\n" https://yoursite.asia/api/health || true
      log "Done. Open https://yoursite.asia"
      exit 0
    fi
    log "Port $port not healthy, trying next..."
    pm2 delete sitegpt 2>/dev/null || true
  done

  log "Restore failed. Recent logs:"
  pm2 logs sitegpt --lines 20 --nostream || true
  exit 1
}

main "$@"
