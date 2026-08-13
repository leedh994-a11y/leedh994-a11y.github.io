#!/usr/bin/env bash
# Full site restore for yoursite.asia
# curl -fsSL https://cdn.jsdelivr.net/gh/leedh994-a11y/leedh994-a11y.github.io@main/scripts/aliyun-nuke-restore.sh | bash

set -euo pipefail

BRANCH="${BRANCH:-main}"
REPO="${REPO:-https://github.com/leedh994-a11y/leedh994-a11y.github.io.git}"
APP=""
TMP=""

log() { echo "[restore] $*"; }

detect_nginx_port() {
  local p
  p="$(grep -rh "proxy_pass" /etc/nginx/ 2>/dev/null | grep -oE '127\.0\.0\.1:[0-9]+|localhost:[0-9]+|:[0-9]+' | grep -oE '[0-9]+$' | head -1 || true)"
  [ -n "$p" ] && [ "$p" != "127" ] && echo "$p" && return
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
  echo "/opt/sitegpt"
}

free_disk_space() {
  log "Free disk space..."
  rm -rf /tmp/yoursite-restore-* /tmp/yoursite-src-* 2>/dev/null || true
  journalctl --vacuum-size=50M 2>/dev/null || true
  npm cache clean --force 2>/dev/null || true
  pm2 flush 2>/dev/null || true
  # keep only 2 newest backups
  ls -dt /opt/sitegpt.bak.* 2>/dev/null | tail -n +3 | xargs -r rm -rf
  ls -dt /opt/sitegpt.bak.* 2>/dev/null | tail -n +3 | xargs -r rm -rf 2>/dev/null || true
  df -h / /tmp /opt 2>/dev/null || df -h
  avail="$(df / --output=avail -B1 2>/dev/null | tail -1 | tr -d ' ' || echo 0)"
  if [ "${avail:-0}" -lt 104857600 ]; then
    log "WARN: disk still low (<100MB free). Trying aggressive cleanup..."
    rm -rf /root/.npm/_cacache /tmp/* 2>/dev/null || true
    find /opt/sitegpt -name node_modules -type d -prune -exec rm -rf {} + 2>/dev/null || true
    df -h /
  fi
}

install_prereqs() {
  command -v git >/dev/null 2>&1 || { dnf install -y git 2>/dev/null || yum install -y git; }
  if ! command -v node >/dev/null 2>&1; then
    curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
    dnf install -y nodejs 2>/dev/null || yum install -y nodejs
  fi
  command -v pm2 >/dev/null 2>&1 || npm install -g pm2
  command -v rsync >/dev/null 2>&1 || { dnf install -y rsync 2>/dev/null || yum install -y rsync; }
}

fetch_minimal_emergency() {
  local port="$1"
  local base="https://cdn.jsdelivr.net/gh/leedh994-a11y/leedh994-a11y.github.io@main"
  log "Low-disk fallback: download minimal files only"
  mkdir -p "$APP/server" "$APP/css" "$APP/js"
  curl -fsSL "$base/server/emergency.cjs" -o "$APP/server/emergency.cjs"
  for f in index.html pricing.html checkout.html account.html; do
    curl -fsSL "$base/$f" -o "$APP/$f" 2>/dev/null || true
  done
  curl -fsSL "$base/css/style.css" -o "$APP/css/style.css" 2>/dev/null || true
  curl -fsSL "$base/js/locale.js" -o "$APP/js/locale.js" 2>/dev/null || true
  if [ ! -f "$APP/index.html" ]; then
    echo '<!DOCTYPE html><html><body><h1>Sitp GPT</h1><p>Site restoring...</p></body></html>' > "$APP/index.html"
  fi
  if [ ! -f "$APP/.env" ]; then
    echo -e "PORT=${port}\nPUBLIC_URL=https://yoursite.asia" > "$APP/.env"
  else
    grep -q '^PORT=' "$APP/.env" && sed -i "s/^PORT=.*/PORT=${port}/" "$APP/.env" || echo "PORT=${port}" >> "$APP/.env"
  fi
}

sync_code() {
  local port="$1"
  local env_bak=""
  TMP="${APP}/.restore-tmp"

  log "Clone branch $BRANCH into $TMP (use app dir, not /tmp)"
  rm -rf "$TMP"
  mkdir -p "$TMP"

  if ! git clone -b "$BRANCH" --depth 1 "$REPO" "$TMP" 2>/dev/null; then
    log "GitHub slow — try mirror..."
    if ! git clone -b "$BRANCH" --depth 1 "https://ghproxy.net/${REPO}" "$TMP" 2>/dev/null; then
      log "git clone failed (disk or network) — minimal download"
      fetch_minimal_emergency "$port"
      return 0
    fi
  fi

  mkdir -p "$APP/server/data"
  [ -f "$APP/.env" ] && env_bak="$(mktemp -p "$APP" 2>/dev/null || mktemp)" && cp -a "$APP/.env" "$env_bak"
  [ -d "$APP/server/data" ] && mkdir -p "$TMP/server/data" && cp -a "$APP/server/data/." "$TMP/server/data/" 2>/dev/null || true

  log "Sync files -> $APP"
  rsync -a --delete \
    --exclude node_modules \
    --exclude .git \
    --exclude server/data \
    "$TMP/" "$APP/"
  rm -rf "$TMP"

  if [ -n "$env_bak" ] && [ -f "$env_bak" ]; then
    cp -a "$env_bak" "$APP/.env"
    rm -f "$env_bak"
  elif [ ! -f "$APP/.env" ]; then
    printf 'PORT=%s\nPUBLIC_URL=https://yoursite.asia\n' "$port" > "$APP/.env"
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
  [ -f "$APP/server/index.js" ] || return 1
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
  free_disk_space
  install_prereqs
  APP="$(find_app_dir)"
  mkdir -p "$APP"
  log "App directory: $APP"

  NGINX_PORT="$(detect_nginx_port)"
  log "Nginx backend port: $NGINX_PORT"

  sync_code "$NGINX_PORT"
  pm2_cleanup
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
    if [ -f "$APP/package.json" ] && npm_install && start_main "$NGINX_PORT"; then
      log "已升级到完整后端 (PayPal/邮件)"
    else
      log "保持应急静态模式（磁盘或 npm 不足时可正常浏览首页）"
    fi
    exit 0
  fi

  log "本地 OK 但公网仍 $PUB。检查 nginx 端口是否 ${NGINX_PORT}"
  log "可执行: grep -r proxy_pass /etc/nginx/ && ss -tlnp | grep node"
  exit 1
}

main "$@"
