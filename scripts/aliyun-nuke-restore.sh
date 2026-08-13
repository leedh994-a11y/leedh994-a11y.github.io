#!/usr/bin/env bash
# Full site restore for yoursite.asia — re-downloads code, starts emergency server, then main app.
# China-friendly CDN:
#   curl -fsSL https://cdn.jsdelivr.net/gh/leedh994-a11y/leedh994-a11y.github.io@cursor/yoursite-order-notify-fd54/scripts/aliyun-nuke-restore.sh | bash

set -euo pipefail

BRANCH="${BRANCH:-cursor/yoursite-order-notify-fd54}"
REPO="${REPO:-https://github.com/leedh994-a11y/leedh994-a11y.github.io.git}"
APP=""
TMP="/tmp/yoursite-restore-$$"

log() { echo "[restore] $*"; }

detect_nginx_port() {
  local p
  p="$(grep -rh "proxy_pass" /etc/nginx/ 2>/dev/null | grep -oE '[0-9]+' | head -1 || true)"
  [ -n "$p" ] && echo "$p" && return
  echo "3000"
}

find_app_dir() {
  local d
  for d in /opt/sitegpt /var/www/yoursite /root/leedh994-a11y.github.io /root/sitegpt /home/sitegpt; do
    if [ -d "$d" ] && { [ -f "$d/index.html" ] || [ -f "$d/server.js" ] || [ -f "$d/server/index.js" ]; }; then
      echo "$d"
      return
    fi
  done
  # pm2 hint
  local cwd
  cwd="$(pm2 jlist 2>/dev/null | grep -oE '"/opt[^"]+"|"/var[^"]+"' | head -1 | tr -d '"' || true)"
  [ -n "$cwd" ] && [ -d "$cwd" ] && echo "$cwd" && return
  echo "/opt/sitegpt"
}

install_prereqs() {
  command -v git >/dev/null 2>&1 || { dnf install -y git 2>/dev/null || yum install -y git; }
  if ! command -v node >/dev/null 2>&1; then
    curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
    dnf install -y nodejs 2>/dev/null || yum install -y nodejs
  fi
  command -v pm2 >/dev/null 2>&1 || npm install -g pm2
}

sync_code() {
  local port="$1"
  local env_bak=""
  log "Clone branch $BRANCH"
  rm -rf "$TMP"
  if ! git clone -b "$BRANCH" --depth 1 "$REPO" "$TMP" 2>/dev/null; then
    log "GitHub slow — try mirror..."
    git clone -b "$BRANCH" --depth 1 "https://ghproxy.net/${REPO}" "$TMP"
  fi

  mkdir -p "$APP/server/data"
  [ -f "$APP/.env" ] && env_bak="$(mktemp)" && cp -a "$APP/.env" "$env_bak"
  [ -d "$APP/server/data" ] && mkdir -p "$TMP/server/data" && cp -a "$APP/server/data/." "$TMP/server/data/" 2>/dev/null || true

  log "Sync files -> $APP"
  rsync -a --delete \
    --exclude node_modules \
    --exclude .git \
    --exclude server/data \
    "$TMP/" "$APP/"

  if [ -n "$env_bak" ] && [ -f "$env_bak" ]; then
    cp -a "$env_bak" "$APP/.env"
    rm -f "$env_bak"
  elif [ ! -f "$APP/.env" ]; then
    cat > "$APP/.env" <<EOF
PORT=${port}
PUBLIC_URL=https://yoursite.asia
EOF
  fi

  if grep -q '^PORT=' "$APP/.env" 2>/dev/null; then
    sed -i "s/^PORT=.*/PORT=${port}/" "$APP/.env"
  else
    echo "PORT=${port}" >> "$APP/.env"
  fi
}

npm_install() {
  cd "$APP"
  npm config set registry https://registry.npmmirror.com 2>/dev/null || true
  npm install --omit=dev 2>/dev/null || npm install
}

pm2_cleanup() {
  pm2 delete sitegpt 2>/dev/null || true
  pm2 delete sitp-gpt 2>/dev/null || true
}

start_emergency() {
  local port="$1"
  log "Start emergency static server on port $port"
  cd "$APP"
  export PORT="$port"
  pm2 start server/emergency.cjs --name sitegpt --cwd "$APP" --update-env
  pm2 save 2>/dev/null || true
  sleep 2
}

start_main() {
  local port="$1"
  if [ ! -f "$APP/server/index.js" ]; then
    return 1
  fi
  log "Upgrade to main app server/index.js"
  cd "$APP"
  export PORT="$port"
  pm2 delete sitegpt 2>/dev/null || true
  pm2 start server/index.js --name sitegpt --cwd "$APP" --update-env
  pm2 save 2>/dev/null || true
  sleep 3
  curl -sf -m 5 "http://127.0.0.1:${port}/api/health" >/dev/null 2>&1
}

backend_ok() {
  local port="$1"
  ss -tlnp 2>/dev/null | grep -q ":${port} " || return 1
  local code
  code="$(curl -s -o /dev/null -m 5 -w '%{http_code}' "http://127.0.0.1:${port}/" 2>/dev/null || echo 000)"
  [ "$code" = "200" ] || [ "$code" = "301" ] || [ "$code" = "302" ]
}

main() {
  [ "$(id -u)" -eq 0 ] || { echo "请用 root 运行"; exit 1; }

  echo "========== yoursite.asia 一键恢复 =========="
  install_prereqs
  APP="$(find_app_dir)"
  mkdir -p "$APP"
  log "App directory: $APP"

  NGINX_PORT="$(detect_nginx_port)"
  log "Nginx backend port: $NGINX_PORT"

  sync_code "$NGINX_PORT"
  pm2_cleanup

  # Emergency server first (no npm required)
  start_emergency "$NGINX_PORT"
  if ! backend_ok "$NGINX_PORT"; then
    for try_port in 3000 3456 8080; do
      [ "$try_port" = "$NGINX_PORT" ] && continue
      log "Retry emergency on port $try_port"
      pm2 delete sitegpt 2>/dev/null || true
      start_emergency "$try_port"
      backend_ok "$try_port" && NGINX_PORT="$try_port" && break
    done
  fi

  if ! backend_ok "$NGINX_PORT"; then
    log "FAILED — emergency server not responding"
    pm2 logs sitegpt --lines 20 --nostream 2>/dev/null || true
    exit 1
  fi

  log "Emergency OK on port $NGINX_PORT"
  PUB="$(curl -s -o /dev/null -m 15 -w '%{http_code}' https://yoursite.asia/ 2>/dev/null || echo 000)"
  log "Public https://yoursite.asia => HTTP $PUB"

  if [ "$PUB" = "200" ] || [ "$PUB" = "301" ] || [ "$PUB" = "302" ]; then
    log "网站已恢复访问！"
    if npm_install && start_main "$NGINX_PORT"; then
      log "已升级到完整后端 (PayPal/邮件)"
    else
      log "完整后端未启动，保持应急静态模式"
      pm2 delete sitegpt 2>/dev/null || true
      start_emergency "$NGINX_PORT"
    fi
    exit 0
  fi

  if [ "$NGINX_PORT" != "$(detect_nginx_port)" ]; then
    log "应用已在 $NGINX_PORT 运行，但 nginx 转发到 $(detect_nginx_port)"
    log "请执行: sed -i 's/proxy_pass.*/proxy_pass http://127.0.0.1:${NGINX_PORT};/' /etc/nginx/conf.d/*.conf && nginx -t && systemctl reload nginx"
  fi

  log "本地已启动，公网仍异常。请把以上全部输出发给技术支持。"
  exit 1
}

main "$@"

