#!/usr/bin/env bash
# Restore tools API backend on Alibaba Cloud server
# curl -fsSL https://cdn.jsdelivr.net/gh/leedh994-a11y/leedh994-a11y.github.io@main/scripts/aliyun-restore-tools.sh | bash

set -euo pipefail

APP="${APP_DIR:-/opt/sitegpt}"
BRANCH="${BRANCH:-main}"
REPO="${REPO:-https://github.com/leedh994-a11y/leedh994-a11y.github.io.git}"
PORT="${PORT:-3456}"
TMP=""

log() { echo "[restore-tools] $*"; }

main() {
  [ "$(id -u)" -eq 0 ] || { echo "请用 root 运行 / Run as root"; exit 1; }

  echo "========== yoursite.asia tools API restore =========="
  command -v git >/dev/null 2>&1 || yum install -y git 2>/dev/null || dnf install -y git
  command -v node >/dev/null 2>&1 || { curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -; yum install -y nodejs 2>/dev/null || dnf install -y nodejs; }
  command -v pm2 >/dev/null 2>&1 || npm install -g pm2

  mkdir -p "$APP/server/data"
  log "App: $APP  Port: $PORT"

  if [ -d "$APP/.git" ]; then
    log "Pull latest ($BRANCH) in $APP..."
    cd "$APP"
    git fetch origin "$BRANCH"
    git reset --hard "origin/$BRANCH"
  else
    TMP="/var/tmp/yoursite-tools-restore-$$"
    rm -rf "$TMP"
    log "Full clone to $APP (branch $BRANCH)..."
    if ! git clone -b "$BRANCH" --depth 1 "$REPO" "$TMP" 2>/dev/null; then
      git clone -b "$BRANCH" --depth 1 "https://ghproxy.net/${REPO}" "$TMP"
    fi
    [ -d "$APP/server/data" ] && mkdir -p "$TMP/server/data" && cp -a "$APP/server/data/." "$TMP/server/data/" 2>/dev/null || true
    rsync -a --delete --exclude node_modules --exclude .git "$TMP/" "$APP/"
    rm -rf "$TMP"
    cd "$APP"
  fi

  if [ -f "$APP/.env" ]; then
    if grep -q '^PORT=' "$APP/.env"; then
      sed -i "s/^PORT=.*/PORT=${PORT}/" "$APP/.env"
    else
      echo "PORT=${PORT}" >> "$APP/.env"
    fi
  else
  cat > "$APP/.env" <<EOF
PUBLIC_URL=https://yoursite.asia
PORT=${PORT}
DATA_DIR=./server/data
EOF
  fi

  log "npm install..."
  cd "$APP"
  npm install --omit=dev

  log "Restart pm2 sitegpt on port $PORT..."
  pm2 delete sitegpt 2>/dev/null || true
  PORT="$PORT" pm2 start server/index.js --name sitegpt --cwd "$APP"
  pm2 save

  sleep 2
  if curl -sf "http://127.0.0.1:${PORT}/api/health" >/dev/null; then
    log "Health check OK"
  else
    log "WARN: health check failed — check pm2 logs sitegpt"
  fi

  if curl -sf -X POST "http://127.0.0.1:${PORT}/api/convert/json" \
    -H "Content-Type: application/json" \
    -d '{"content":"{\"hello\":\"world\"}"}' | grep -q '"success":true'; then
    log "Tools API check OK"
  else
    log "WARN: tools API check failed"
  fi

  log "Done. Tools API should be live at https://yoursite.asia/api/*"
}

main "$@"
