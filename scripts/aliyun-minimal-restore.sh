#!/usr/bin/env bash
# Minimal restore — ~30s, no git clone, no npm. Homepage only.
# curl -fsSL https://cdn.jsdelivr.net/gh/leedh994-a11y/leedh994-a11y.github.io@main/scripts/aliyun-minimal-restore.sh | bash

set -euo pipefail

APP="${APP_DIR:-/opt/sitegpt}"
BASE="https://cdn.jsdelivr.net/gh/leedh994-a11y/leedh994-a11y.github.io@main"
PM2_NAME="sitegpt"

log() { echo "[minimal] $*"; }

detect_port() {
  local p
  p="$(grep -rh "proxy_pass" /etc/nginx/ 2>/dev/null | grep -oE '127\.0\.0\.1:[0-9]+|localhost:[0-9]+' | grep -oE '[0-9]+$' | head -1 || true)"
  [ -n "$p" ] && echo "$p" && return
  echo "3000"
}

main() {
  [ "$(id -u)" -eq 0 ] || { echo "请用 root 运行"; exit 1; }

  echo "========== 精简恢复（约30秒）=========="
  command -v pm2 >/dev/null 2>&1 || npm install -g pm2
  command -v curl >/dev/null 2>&1 || yum install -y curl 2>/dev/null || dnf install -y curl

  mkdir -p "$APP/server" "$APP/css" "$APP/js" "$APP/img"
  PORT="$(detect_port)"
  log "App: $APP  Port: $PORT"

  log "Download emergency server + homepage..."
  curl -fsSL "$BASE/server/emergency.cjs" -o "$APP/server/emergency.cjs"
  curl -fsSL "$BASE/index.html" -o "$APP/index.html" || \
    echo '<!DOCTYPE html><html lang="zh"><head><meta charset="UTF-8"><title>Sitp GPT</title></head><body><h1>Sitp GPT</h1><p>网站已恢复，完整功能稍后升级。</p><a href="/pricing.html">Pricing</a></body></html>' > "$APP/index.html"
  curl -fsSL "$BASE/pricing.html" -o "$APP/pricing.html" 2>/dev/null || true
  curl -fsSL "$BASE/css/style.css" -o "$APP/css/style.css" 2>/dev/null || true
  curl -fsSL "$BASE/css/home.css" -o "$APP/css/home.css" 2>/dev/null || true
  curl -fsSL "$BASE/js/locale.js" -o "$APP/js/locale.js" 2>/dev/null || true

  printf 'PORT=%s\nPUBLIC_URL=https://yoursite.asia\n' "$PORT" > "$APP/.env"

  pm2 delete "$PM2_NAME" 2>/dev/null || true
  pm2 delete sitp-gpt 2>/dev/null || true
  PORT="$PORT" pm2 start "$APP/server/emergency.cjs" --name "$PM2_NAME" --cwd "$APP" --update-env
  pm2 save 2>/dev/null || true
  sleep 2

  LOCAL="$(curl -s -o /dev/null -m 5 -w '%{http_code}' "http://127.0.0.1:${PORT}/" 2>/dev/null || echo 000)"
  PUB="$(curl -s -o /dev/null -m 10 -w '%{http_code}' https://yoursite.asia/ 2>/dev/null || echo 000)"
  log "Local  => HTTP $LOCAL"
  log "Public => HTTP $PUB"

  if [ "$LOCAL" = "200" ] || [ "$PUB" = "200" ]; then
    log "首页已拉起！打开 https://yoursite.asia"
    exit 0
  fi

  log "端口 $PORT 未通，尝试 3000 / 3456..."
  for try in 3000 3456; do
    [ "$try" = "$PORT" ] && continue
    pm2 delete "$PM2_NAME" 2>/dev/null || true
    PORT="$try" pm2 start "$APP/server/emergency.cjs" --name "$PM2_NAME" --cwd "$APP" --update-env
    sleep 2
    LOCAL="$(curl -s -o /dev/null -m 5 -w '%{http_code}' "http://127.0.0.1:${try}/" 2>/dev/null || echo 000)"
    if [ "$LOCAL" = "200" ]; then
      log "本地 OK on $try。若公网仍502，nginx 可能转发到其他端口。"
      log "执行: grep -r proxy_pass /etc/nginx/"
      exit 0
    fi
  done

  log "失败 — 发我: pm2 logs $PM2_NAME --lines 15"
  exit 1
}

main "$@"
