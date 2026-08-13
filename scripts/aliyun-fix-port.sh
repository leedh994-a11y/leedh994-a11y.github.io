#!/usr/bin/env bash
# Fix 502: restore missing files + start on nginx port 3456
# curl -fsSL https://cdn.jsdelivr.net/gh/leedh994-a11y/leedh994-a11y.github.io@main/scripts/aliyun-fix-port.sh | bash

set -euo pipefail

APP="${APP_DIR:-/opt/sitegpt}"
PORT="3456"
BRANCH="${BRANCH:-main}"
REPO="${REPO:-https://github.com/leedh994-a11y/leedh994-a11y.github.io.git}"
BASE="https://cdn.jsdelivr.net/gh/leedh994-a11y/leedh994-a11y.github.io@main"

log() { echo "[fix-port] $*"; }

has_entry() {
  [ -f "$APP/server/index.js" ] || [ -f "$APP/server/emergency.cjs" ] || [ -f "$APP/server.js" ]
}

download_minimal() {
  log "Download minimal server files..."
  mkdir -p "$APP/server" "$APP/css" "$APP/js"
  curl -fsSL "$BASE/server/emergency.cjs" -o "$APP/server/emergency.cjs"
  curl -fsSL "$BASE/server/index.js" -o "$APP/server/index.js" 2>/dev/null || true
  for f in package.json index.html pricing.html checkout.html account.html; do
    curl -fsSL "$BASE/$f" -o "$APP/$f" 2>/dev/null || true
  done
  mkdir -p "$APP/server"
  for f in billing.js billing-store.js paypal.js mail.js plans.js store.js; do
    curl -fsSL "$BASE/server/$f" -o "$APP/server/$f" 2>/dev/null || true
  done
}

clone_full() {
  local tmp="/var/tmp/sitegpt-fix-$$"
  log "Clone full site to $tmp..."
  rm -rf "$tmp"
  if ! git clone -b "$BRANCH" --depth 1 "$REPO" "$tmp" 2>/dev/null; then
    git clone -b "$BRANCH" --depth 1 "https://ghproxy.net/${REPO}" "$tmp"
  fi
  mkdir -p "$APP"
  rsync -a --exclude node_modules --exclude .git "$tmp/" "$APP/"
  rm -rf "$tmp"
}

ensure_files() {
  if has_entry; then
    log "Server entry found"
    return 0
  fi
  log "No server entry in $APP — restoring files..."
  command -v git >/dev/null 2>&1 || yum install -y git 2>/dev/null || dnf install -y git
  command -v rsync >/dev/null 2>&1 || yum install -y rsync 2>/dev/null || dnf install -y rsync
  if ! clone_full 2>/dev/null; then
    log "git clone failed — CDN fallback"
    download_minimal
  fi
  has_entry || { echo "ERROR: still no server file in $APP"; ls -la "$APP" 2>/dev/null || true; exit 1; }
}

write_env() {
  local paypal_secret="${PAYPAL_CLIENT_SECRET:-}"
  local smtp_pass="${SMTP_PASS:-}"
  [ -n "$paypal_secret" ] || paypal_secret="$(grep -E '^PAYPAL_CLIENT_SECRET=' "$APP/.env" 2>/dev/null | cut -d= -f2- || true)"
  [ -n "$smtp_pass" ] || smtp_pass="$(grep -E '^SMTP_PASS=' "$APP/.env" 2>/dev/null | cut -d= -f2- || true)"

  cat > "$APP/.env" <<EOF
PUBLIC_URL=https://yoursite.asia
PAYPAL_CLIENT_ID=BAA_HhKZAA-3hl-Bx67hXC5snkRbipDaPzkWGBvcZKYwpYe9IQAVSrdtkHmtwTmsN2YPBZDpkVb9RHc3eU
PAYPAL_CLIENT_SECRET=${paypal_secret}
PAYPAL_MODE=live
ORDER_NOTIFY_EMAIL=ddb1520@outlook.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=LeeDh994@gmail.com
SMTP_PASS=${smtp_pass}
SMTP_FROM=LeeDh994@gmail.com
BILLING_ADMIN_SECRET=sitp-notify-admin-2026
PORT=${PORT}
DATA_DIR=./server/data
EOF
}

pick_entry() {
  if [ -f "$APP/server/index.js" ] && [ -f "$APP/package.json" ]; then
    echo "full"
  elif [ -f "$APP/server/index.js" ]; then
    echo "index"
  elif [ -f "$APP/server/emergency.cjs" ]; then
    echo "emergency"
  elif [ -f "$APP/server.js" ]; then
    echo "legacy"
  else
    echo "none"
  fi
}

main() {
  [ "$(id -u)" -eq 0 ] || { echo "请用 root 运行"; exit 1; }
  mkdir -p "$APP/server/data"

  echo "========== 修复 502 (端口 3456) =========="
  log "nginx -> 127.0.0.1:3456"

  ensure_files
  write_env

  if [ -f "$APP/package.json" ] && [ ! -d "$APP/node_modules/express" ]; then
    log "npm install..."
    cd "$APP"
    npm config set registry https://registry.npmmirror.com 2>/dev/null || true
    npm install --omit=dev 2>/dev/null || npm install
  fi

  pm2 delete sitegpt sitp-gpt 2>/dev/null || true

  case "$(pick_entry)" in
    full|index)
      log "Start server/index.js on :3456"
      PORT=3456 pm2 start "$APP/server/index.js" --name sitegpt --cwd "$APP" --update-env
      ;;
    emergency)
      log "Start emergency.cjs on :3456"
      PORT=3456 pm2 start "$APP/server/emergency.cjs" --name sitegpt --cwd "$APP" --update-env
      ;;
    legacy)
      log "Start server.js on :3456"
      PORT=3456 pm2 start "$APP/server.js" --name sitegpt --cwd "$APP" --update-env
      ;;
    *)
      echo "No server entry"; exit 1
      ;;
  esac

  pm2 save 2>/dev/null || true
  sleep 3

  ss -tlnp | grep ':3456 ' || true
  curl -s "http://127.0.0.1:3456/api/health" 2>/dev/null || curl -s -o /dev/null -w "GET / => %{http_code}\n" "http://127.0.0.1:3456/"
  PUB="$(curl -s -o /dev/null -m 10 -w '%{http_code}' https://yoursite.asia/ 2>/dev/null || echo 000)"
  log "Public https://yoursite.asia => HTTP $PUB"
  [ "$PUB" = "200" ] || [ "$PUB" = "301" ] && log "网站已恢复！" || log "若仍502: pm2 logs sitegpt --lines 20"
}

main "$@"
