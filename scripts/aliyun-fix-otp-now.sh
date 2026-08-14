#!/usr/bin/env bash
# One-shot fix: SMTP + mail relay on public port for pzhisen OTP
# Run on Alibaba Workbench as root (ONE line only):
#   bash -c "$(curl -fsSL https://cdn.jsdelivr.net/gh/leedh994-a11y/leedh994-a11y.github.io@main/scripts/aliyun-fix-otp-now.sh)"

set -euo pipefail

APP="${APP_DIR:-/opt/sitegpt}"
REPO="${REPO:-https://github.com/leedh994-a11y/leedh994-a11y.github.io.git}"
BRANCH="${BRANCH:-main}"
SMTP_PASS="${SMTP_PASS:-bpjsrhatyapqigfw}"
SMTP_USER="${SMTP_USER:-LeeDh994@gmail.com}"
RELAY_SECRET="${MAIL_RELAY_SECRET:-sitp-notify-admin-2026}"

log() { echo "[fix-otp] $*"; }

main() {
  [ "$(id -u)" -eq 0 ] || { echo "Run as root"; exit 1; }

  command -v git >/dev/null 2>&1 || yum install -y git rsync 2>/dev/null || dnf install -y git rsync
  command -v node >/dev/null 2>&1 || { curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -; yum install -y nodejs 2>/dev/null || dnf install -y nodejs; }
  command -v pm2 >/dev/null 2>&1 || npm install -g pm2

  local tmp="/var/tmp/otp-fix-$$"
  rm -rf "$tmp"
  log "Clone latest code..."
  git clone -b "$BRANCH" --depth 1 "$REPO" "$tmp" 2>/dev/null || \
    git clone -b "$BRANCH" --depth 1 "https://ghproxy.net/${REPO}" "$tmp"
  mkdir -p "$APP/server/data"
  rsync -a --exclude node_modules --exclude .git "$tmp/" "$APP/"
  rm -rf "$tmp"

  log "Write .env (SMTP + relay)..."
  cat > "$APP/.env" <<EOF
PUBLIC_URL=https://yoursite.asia
PORT=3000
DATA_DIR=./server/data
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=${SMTP_USER}
SMTP_PASS=${SMTP_PASS}
SMTP_FROM=${SMTP_USER}
MAIL_RELAY_SECRET=${RELAY_SECRET}
BILLING_ADMIN_SECRET=${RELAY_SECRET}
ORDER_NOTIFY_EMAIL=ddb1520@outlook.com
EOF

  cd "$APP"
  npm install --omit=dev 2>/dev/null || npm install --omit=dev

  log "Restart app on port 3000 (public backend)..."
  pm2 delete sitegpt 2>/dev/null || true
  PORT=3000 pm2 start server/index.js --name sitegpt --cwd "$APP" --update-env
  pm2 save 2>/dev/null || true
  sleep 3

  log "Local check :3000"
  curl -sf "http://127.0.0.1:3000/api/mail/relay/status" || echo "WARN local 3000 failed"
  echo

  log "Docker nginx containers (if any):"
  docker ps --format 'table {{.Names}}\t{{.Ports}}' 2>/dev/null || echo "(no docker)"

  log "Public check"
  curl -sf "https://yoursite.asia/api/mail/relay/status" || echo "WARN public still failing — check SLB/Docker proxy"
  echo
  log "Done. pzhisen OTP relay: https://yoursite.asia/api/mail/send"
}

main "$@"
