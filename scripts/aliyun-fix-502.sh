#!/usr/bin/env bash
# One-command fix for https://yoursite.asia 502 Bad Gateway
# Run on Alibaba server (Workbench) as root — paste ONE line only:
#   curl -fsSL https://raw.githubusercontent.com/leedh994-a11y/leedh994-a11y.github.io/cursor/yoursite-order-notify-fd54/scripts/aliyun-fix-502.sh | bash

set -euo pipefail

APP="${APP_DIR:-/opt/sitegpt}"
PM2_NAME="${PM2_NAME:-sitegpt}"

log() { echo "[fix-502] $*"; }

detect_nginx_port() {
  local p
  p="$(grep -rh "proxy_pass" /etc/nginx/ 2>/dev/null | grep -oE '127\.0\.0\.1:[0-9]+|localhost:[0-9]+|:[0-9]+' | grep -oE '[0-9]+' | head -1 || true)"
  [ -n "$p" ] && echo "$p" && return
  echo "3000"
}

port_listening() {
  ss -tlnp 2>/dev/null | grep -q ":${1} "
}

backend_ok() {
  local port="$1"
  port_listening "$port" || return 1
  curl -sf -m 3 "http://127.0.0.1:${port}/api/health" >/dev/null 2>&1 && return 0
  curl -sf -m 3 "http://127.0.0.1:${port}/" >/dev/null 2>&1 && return 0
  local code
  code="$(curl -s -o /dev/null -m 3 -w '%{http_code}' "http://127.0.0.1:${port}/" 2>/dev/null || echo 000)"
  [ "$code" != "000" ] && [ "$code" != "502" ]
}

pick_script() {
  if [ -f "$APP/server.js" ]; then
    echo "$APP/server.js"
  elif [ -f "$APP/server/index.js" ]; then
    echo "$APP/server/index.js"
  else
    echo ""
  fi
}

restore_from_backup() {
  local bak script
  for bak in $(ls -dt "${APP}.bak."* 2>/dev/null || true); do
    [ -d "$bak" ] || continue
    if [ ! -f "$APP/server.js" ] && [ -f "$bak/server.js" ]; then
      log "Restore server.js from $bak"
      cp -a "$bak/server.js" "$APP/"
    fi
    if [ ! -f "$APP/server/index.js" ] && [ -f "$bak/server/index.js" ]; then
      log "Restore server/ from $bak"
      mkdir -p "$APP/server"
      cp -a "$bak/server/." "$APP/server/"
    fi
    script="$(pick_script)"
    [ -n "$script" ] && return 0
  done
  return 0
}

set_port_env() {
  local port="$1"
  cd "$APP"
  if [ -f .env ]; then
    if grep -q '^PORT=' .env; then
      sed -i "s/^PORT=.*/PORT=${port}/" .env
    else
      echo "PORT=${port}" >> .env
    fi
  else
    echo "PORT=${port}" > .env
  fi
}

start_backend() {
  local script="$1"
  local port="$2"
  log "Start $PM2_NAME: $script PORT=$port"
  cd "$APP"
  set_port_env "$port"

  if [[ "$script" == *server/index.js* ]] && [ -f package.json ]; then
    command -v npm >/dev/null 2>&1 || true
    if [ -f package.json ]; then
      npm install --omit=dev 2>/dev/null || npm install 2>/dev/null || true
    fi
  fi

  pm2 delete "$PM2_NAME" 2>/dev/null || true
  PORT="$port" pm2 start "$script" --name "$PM2_NAME" --cwd "$APP" --update-env
  pm2 save 2>/dev/null || true
  sleep 3
}

echo "========== DIAGNOSE =========="
echo "pm2:"
pm2 list 2>/dev/null || echo "(pm2 not found)"
echo ""
echo "listening ports:"
ss -tlnp 2>/dev/null | grep -E 'node|3000|3456|8080' || echo "(no node ports)"
echo ""
echo "nginx proxy_pass:"
grep -rh "proxy_pass" /etc/nginx/ 2>/dev/null || echo "(none)"
echo ""
echo "app files:"
ls -la "$APP/server.js" "$APP/server/index.js" "$APP/.env" 2>/dev/null || ls -la "$APP" 2>/dev/null | head -12 || echo "Missing $APP"
echo ""

[ "$(id -u)" -eq 0 ] || { echo "ERROR: run as root"; exit 1; }
[ -d "$APP" ] || { echo "ERROR: $APP not found"; exit 1; }

command -v pm2 >/dev/null 2>&1 || npm install -g pm2
command -v curl >/dev/null 2>&1 || dnf install -y curl 2>/dev/null || yum install -y curl 2>/dev/null || true

restore_from_backup

SCRIPT="$(pick_script)"
if [ -z "$SCRIPT" ]; then
  echo "ERROR: no server.js or server/index.js — check backups:"
  ls -dt "${APP}.bak."* 2>/dev/null | head -3 || true
  exit 1
fi

NGINX_PORT="$(detect_nginx_port)"
log "nginx expects backend on port: $NGINX_PORT"
log "using entry: $SCRIPT"

SEEN=""
for PORT in "$NGINX_PORT" 3000 3456 8080; do
  case " $SEEN " in *" $PORT "*) continue ;; esac
  SEEN="$SEEN $PORT"
  start_backend "$SCRIPT" "$PORT"
  if backend_ok "$PORT"; then
    log "SUCCESS: backend responds on port $PORT"
    curl -s -m 3 "http://127.0.0.1:${PORT}/api/health" 2>/dev/null || curl -s -m 3 -o /dev/null -w "GET / => HTTP %{http_code}\n" "http://127.0.0.1:${PORT}/"
    echo ""
    PUB="$(curl -s -o /dev/null -m 10 -w '%{http_code}' https://yoursite.asia/ 2>/dev/null || echo 000)"
    log "Public https://yoursite.asia => HTTP $PUB"
    if [ "$PUB" = "200" ] || [ "$PUB" = "301" ] || [ "$PUB" = "302" ]; then
      log "Site is back online."
      exit 0
    fi
    if [ "$PORT" != "$NGINX_PORT" ]; then
      log "WARN: app on $PORT but nginx proxies to $NGINX_PORT"
      log "Fix nginx or re-run with: PORT=$PORT bash -c '...'"
    fi
    exit 0
  fi
  log "Port $PORT not OK, trying next..."
  pm2 delete "$PM2_NAME" 2>/dev/null || true
done

echo "========== FAILED =========="
pm2 logs "$PM2_NAME" --lines 30 --nostream 2>/dev/null || true
echo ""
echo "Paste ALL output above when asking for help."
exit 1
