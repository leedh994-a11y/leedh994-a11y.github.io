#!/usr/bin/env bash
# Full restore: all pages + PayPal + email notifications
# curl -fsSL https://cdn.jsdelivr.net/gh/leedh994-a11y/leedh994-a11y.github.io@main/scripts/aliyun-full-restore.sh | bash
#
# With secrets inline:
# PAYPAL_CLIENT_SECRET=xxx SMTP_PASS=xxx bash -c "$(curl -fsSL .../aliyun-full-restore.sh)"

set -euo pipefail

APP="${APP_DIR:-/opt/sitegpt}"
BRANCH="${BRANCH:-main}"
REPO="${REPO:-https://github.com/leedh994-a11y/leedh994-a11y.github.io.git}"
TMP=""

log() { echo "[full-restore] $*"; }

detect_nginx_port() {
  local p
  p="$(grep -rh "proxy_pass" /etc/nginx/ 2>/dev/null | grep -oE '127\.0\.0\.1:[0-9]+|localhost:[0-9]+' | grep -oE '[0-9]+$' | head -1 || true)"
  [ -n "$p" ] && echo "$p" && return
  echo "3000"
}

write_env() {
  local port="$1"
  local paypal_id="${PAYPAL_CLIENT_ID:-BAA_HhKZAA-3hl-Bx67hXC5snkRbipDaPzkWGBvcZKYwpYe9IQAVSrdtkHmtwTmsN2YPBZDpkVb9RHc3eU}"
  local paypal_secret="${PAYPAL_CLIENT_SECRET:-}"
  local smtp_pass="${SMTP_PASS:-}"
  local openrouter_key="${OPENROUTER_API_KEY:-}"

  if [ -z "$paypal_secret" ] && [ -f "$APP/.env" ]; then
    paypal_secret="$(grep -E '^PAYPAL_CLIENT_SECRET=' "$APP/.env" | cut -d= -f2- || true)"
  fi
  if [ -z "$smtp_pass" ] && [ -f "$APP/.env" ]; then
    smtp_pass="$(grep -E '^SMTP_PASS=' "$APP/.env" | cut -d= -f2- || true)"
  fi
  if [ -z "$openrouter_key" ] && [ -f "$APP/.env" ]; then
    openrouter_key="$(grep -E '^OPENROUTER_API_KEY=' "$APP/.env" | cut -d= -f2- || true)"
  fi

  cat > "$APP/.env" <<EOF
PUBLIC_URL=https://yoursite.asia
PAYPAL_CLIENT_ID=${paypal_id}
PAYPAL_CLIENT_SECRET=${paypal_secret}
PAYPAL_MODE=live
ORDER_NOTIFY_EMAIL=ddb1520@outlook.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=LeeDh994@gmail.com
SMTP_PASS=${smtp_pass}
SMTP_FROM=LeeDh994@gmail.com
BILLING_ADMIN_SECRET=sitp-notify-admin-2026
OPENROUTER_API_KEY=${openrouter_key}
OPENROUTER_SITE_URL=https://yoursite.asia
OPENROUTER_SITE_NAME=Sitp GPT
PORT=${port}
DATA_DIR=./server/data
EOF
  log "Wrote $APP/.env"
}

main() {
  [ "$(id -u)" -eq 0 ] || { echo "请用 root 运行"; exit 1; }

  echo "========== yoursite.asia 完整恢复 =========="
  command -v git >/dev/null 2>&1 || yum install -y git 2>/dev/null || dnf install -y git
  command -v node >/dev/null 2>&1 || { curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -; yum install -y nodejs 2>/dev/null || dnf install -y nodejs; }
  command -v pm2 >/dev/null 2>&1 || npm install -g pm2
  command -v rsync >/dev/null 2>&1 || yum install -y rsync 2>/dev/null || dnf install -y rsync

  mkdir -p "$APP/server/data"
  PORT="$(detect_nginx_port)"
  log "App: $APP  Port: $PORT"

  TMP="/var/tmp/yoursite-restore-$$"
  rm -rf "$TMP"
  log "Clone full site (branch $BRANCH)..."
  if ! git clone -b "$BRANCH" --depth 1 "$REPO" "$TMP" 2>/dev/null; then
    git clone -b "$BRANCH" --depth 1 "https://ghproxy.net/${REPO}" "$TMP"
  fi

  [ -d "$APP/server/data" ] && mkdir -p "$TMP/server/data" && cp -a "$APP/server/data/." "$TMP/server/data/" 2>/dev/null || true

  log "Sync all files..."
  rsync -a --delete \
    --exclude node_modules \
    --exclude .git \
    --exclude server/data \
    --exclude .restore-tmp \
    "$TMP/" "$APP/"
  rm -rf "$TMP"

  log "Verify SEO pages..."
  SEO_N="$(find "$APP/seo" -name '*.html' 2>/dev/null | wc -l | tr -d ' ')"
  log "SEO pages on disk: $SEO_N (expected ~1000)"
  if [ "${SEO_N:-0}" -lt 900 ]; then
    log "SEO incomplete — running seo restore..."
    curl -fsSL "https://cdn.jsdelivr.net/gh/leedh994-a11y/leedh994-a11y.github.io@main/scripts/aliyun-restore-seo.sh" | bash
  fi

  write_env "$PORT"

  log "npm install..."
  cd "$APP"
  npm config set registry https://registry.npmmirror.com 2>/dev/null || true
  npm install --omit=dev

  log "Start full backend..."
  pm2 delete sitegpt sitp-gpt 2>/dev/null || true
  PORT="$PORT" pm2 start server/index.js --name sitegpt --cwd "$APP" --update-env
  pm2 save 2>/dev/null || true
  sleep 4

  log "Health check..."
  curl -sf "http://127.0.0.1:${PORT}/api/health" && echo ""
  curl -s "http://127.0.0.1:${PORT}/api/paypal/status" | head -c 300 && echo ""

  PUB="$(curl -s -o /dev/null -m 15 -w '%{http_code}' https://yoursite.asia/ 2>/dev/null || echo 000)"
  log "Public https://yoursite.asia => HTTP $PUB"

  if [ "$PUB" = "200" ] || [ "$PUB" = "301" ]; then
    log "完整网站已恢复！所有页面 + PayPal + 邮件通知"
    log "测试邮件: curl -X POST http://127.0.0.1:${PORT}/api/billing/admin/notify-test -H 'x-admin-key: sitp-notify-admin-2026'"
  else
    log "本地已启动，公网 $PUB — 检查 nginx 端口是否为 $PORT"
    grep -rh proxy_pass /etc/nginx/ 2>/dev/null || true
  fi
}

main "$@"
