#!/usr/bin/env bash
# Configure Gmail SMTP on yoursite.asia + deploy mail relay for pzhisen OTP
# Run on Alibaba Workbench as root:
#   SMTP_PASS='your-gmail-app-password' bash -c "$(curl -fsSL https://cdn.jsdelivr.net/gh/leedh994-a11y/leedh994-a11y.github.io@main/scripts/aliyun-set-smtp.sh)"

set -euo pipefail

APP="${APP_DIR:-/opt/sitegpt}"
BRANCH="${BRANCH:-main}"
REPO="${REPO:-https://github.com/leedh994-a11y/leedh994-a11y.github.io.git}"
PORT="${PORT:-3456}"

log() { echo "[set-smtp] $*"; }

set_env_var() {
  local file="$1" name="$2" value="$3"
  touch "$file"
  if grep -q "^${name}=" "$file" 2>/dev/null; then
    sed -i "s|^${name}=.*|${name}=${value}|" "$file"
  else
    echo "${name}=${value}" >> "$file"
  fi
}

main() {
  [ "$(id -u)" -eq 0 ] || { echo "Run as root"; exit 1; }

  local smtp_user="${SMTP_USER:-LeeDh994@gmail.com}"
  local smtp_pass="${SMTP_PASS:-}"
  local smtp_from="${SMTP_FROM:-LeeDh994@gmail.com}"
  local relay_secret="${MAIL_RELAY_SECRET:-sitp-notify-admin-2026}"

  if [ -z "$smtp_pass" ] && [ -f "$APP/.env" ]; then
    smtp_pass="$(grep -E '^SMTP_PASS=' "$APP/.env" | cut -d= -f2- || true)"
  fi
  [ -n "$smtp_pass" ] || {
    echo "Set SMTP_PASS=your-gmail-app-password (16-char app password)"
    exit 1
  }

  log "Pull latest ($BRANCH)..."
  if [ -d "$APP/.git" ]; then
    cd "$APP"
    git fetch origin "$BRANCH"
    git reset --hard "origin/$BRANCH"
  else
    echo "No git repo at $APP — clone manually first"
    exit 1
  fi

  log "Write SMTP + mail relay config..."
  set_env_var "$APP/.env" "SMTP_HOST" "smtp.gmail.com"
  set_env_var "$APP/.env" "SMTP_PORT" "587"
  set_env_var "$APP/.env" "SMTP_USER" "$smtp_user"
  set_env_var "$APP/.env" "SMTP_PASS" "$smtp_pass"
  set_env_var "$APP/.env" "SMTP_FROM" "$smtp_from"
  set_env_var "$APP/.env" "MAIL_RELAY_SECRET" "$relay_secret"
  set_env_var "$APP/.env" "BILLING_ADMIN_SECRET" "$relay_secret"

  cd "$APP"
  npm install --omit=dev 2>/dev/null || true
  pm2 restart sitegpt 2>/dev/null || PORT="$PORT" pm2 start server/index.js --name sitegpt --cwd "$APP"
  pm2 save 2>/dev/null || true
  sleep 2

  log "Relay status:"
  curl -sf "http://127.0.0.1:${PORT}/api/mail/relay/status" || true
  echo
  log "Done. pzhisen.online OTP relay: https://yoursite.asia/api/mail/send"
}

main "$@"
