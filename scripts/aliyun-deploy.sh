#!/usr/bin/env bash
# One-command deploy for yoursite.asia on Alibaba Cloud (/opt/sitegpt)
# Usage (on server as root):
#   curl -fsSL https://raw.githubusercontent.com/leedh994-a11y/leedh994-a11y.github.io/cursor/yoursite-order-notify-fd54/scripts/aliyun-deploy.sh | bash
#
# Or with secrets inline (recommended first run):
#   PAYPAL_CLIENT_SECRET=xxx SMTP_PASS=xxx bash aliyun-deploy.sh

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/sitegpt}"
BRANCH="${BRANCH:-cursor/yoursite-order-notify-fd54}"
REPO="${REPO:-https://github.com/leedh994-a11y/leedh994-a11y.github.io.git}"
PORT="${PORT:-3000}"
TMP_SRC="/tmp/yoursite-src-$$"

log() { echo "[deploy] $*"; }
die() { echo "[deploy] ERROR: $*" >&2; exit 1; }

need_root() {
  if [ "$(id -u)" -ne 0 ]; then
    die "Run as root"
  fi
}

install_prereqs() {
  command -v git >/dev/null 2>&1 || dnf install -y git
  if ! command -v node >/dev/null 2>&1; then
    curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
    dnf install -y nodejs
  fi
  command -v pm2 >/dev/null 2>&1 || npm install -g pm2
}

backup_app() {
  if [ -d "$APP_DIR" ]; then
    local bak="${APP_DIR}.bak.$(date +%Y%m%d%H%M%S)"
    log "Backup $APP_DIR -> $bak"
    cp -a "$APP_DIR" "$bak"
  else
    mkdir -p "$APP_DIR"
  fi
}

fetch_source() {
  rm -rf "$TMP_SRC"
  log "Clone $BRANCH"
  git clone -b "$BRANCH" --depth 1 "$REPO" "$TMP_SRC"
}

sync_files() {
  log "Sync into $APP_DIR"
  mkdir -p "$APP_DIR/server" "$APP_DIR/server/data"
  cp -a "$TMP_SRC/server/." "$APP_DIR/server/"
  cp "$TMP_SRC/package.json" "$APP_DIR/"
  if [ -f "$TMP_SRC/package-lock.json" ]; then
    cp "$TMP_SRC/package-lock.json" "$APP_DIR/"
  fi
  # Keep static assets if old monolith had them; optional copy from repo root
  for d in css js img tools zh resources seo; do
    if [ -d "$TMP_SRC/$d" ]; then
      cp -a "$TMP_SRC/$d" "$APP_DIR/" 2>/dev/null || true
    fi
  done
  for f in index.html pricing.html checkout.html account.html login.html; do
    if [ -f "$TMP_SRC/$f" ]; then
      cp "$TMP_SRC/$f" "$APP_DIR/" 2>/dev/null || true
    fi
  done
}

write_env() {
  local paypal_id="${PAYPAL_CLIENT_ID:-BAA_HhKZAA-3hl-Bx67hXC5snkRbipDaPzkWGBvcZKYwpYe9IQAVSrdtkHmtwTmsN2YPBZDpkVb9RHc3eU}"
  local paypal_secret="${PAYPAL_CLIENT_SECRET:-}"
  local smtp_pass="${SMTP_PASS:-}"
  if [ -z "$paypal_secret" ] && [ -f "$APP_DIR/.env" ]; then
    paypal_secret="$(grep -E '^PAYPAL_CLIENT_SECRET=' "$APP_DIR/.env" | cut -d= -f2- || true)"
  fi
  if [ -z "$smtp_pass" ] && [ -f "$APP_DIR/.env" ]; then
    smtp_pass="$(grep -E '^SMTP_PASS=' "$APP_DIR/.env" | cut -d= -f2- || true)"
  fi
  [ -n "$paypal_secret" ] || die "Set PAYPAL_CLIENT_SECRET env var or keep existing .env"
  [ -n "$smtp_pass" ] || die "Set SMTP_PASS env var or keep existing .env"

  cat > "$APP_DIR/.env" <<EOF
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
PORT=${PORT}
DATA_DIR=./server/data
EOF
  log "Wrote $APP_DIR/.env"
}

npm_install() {
  cd "$APP_DIR"
  log "npm install"
  npm install --omit=dev
}

restart_pm2() {
  cd "$APP_DIR"
  log "Restart pm2 sitegpt"
  pm2 delete sitegpt 2>/dev/null || true
  pm2 start server/index.js --name sitegpt --cwd "$APP_DIR" --update-env
  pm2 save
}

health_check() {
  sleep 2
  log "Local health check"
  if curl -sf "http://127.0.0.1:${PORT}/api/health" >/dev/null; then
    log "OK: http://127.0.0.1:${PORT}/api/health"
  else
    log "Local health failed — showing pm2 logs"
    pm2 logs sitegpt --lines 25 --nostream || true
    die "Backend not responding on port ${PORT}"
  fi
  log "PayPal status:"
  curl -s "http://127.0.0.1:${PORT}/api/paypal/status" | head -c 400 || true
  echo ""
  log "Notify test:"
  curl -s -X POST "http://127.0.0.1:${PORT}/api/billing/admin/notify-test" \
    -H "x-admin-key: sitp-notify-admin-2026" || true
  echo ""
}

main() {
  need_root
  install_prereqs
  backup_app
  fetch_source
  sync_files
  write_env
  npm_install
  restart_pm2
  health_check
  log "Done. Test: curl -s https://yoursite.asia/api/health"
}

main "$@"
