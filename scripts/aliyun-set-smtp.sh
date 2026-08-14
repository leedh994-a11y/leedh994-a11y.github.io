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

  log "Ensure app at $APP (branch $BRANCH)..."
  command -v git >/dev/null 2>&1 || yum install -y git 2>/dev/null || dnf install -y git
  command -v node >/dev/null 2>&1 || { curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -; yum install -y nodejs 2>/dev/null || dnf install -y nodejs; }
  command -v pm2 >/dev/null 2>&1 || npm install -g pm2
  command -v rsync >/dev/null 2>&1 || yum install -y rsync 2>/dev/null || dnf install -y rsync

  mkdir -p "$APP/server/data"
  if [ -d "$APP/.git" ]; then
    cd "$APP"
    git fetch origin "$BRANCH"
    git reset --hard "origin/$BRANCH"
  else
    local tmp="/var/tmp/yoursite-smtp-restore-$$"
    rm -rf "$tmp"
    log "No git repo — cloning to $tmp then syncing to $APP..."
    if ! git clone -b "$BRANCH" --depth 1 "$REPO" "$tmp" 2>/dev/null; then
      git clone -b "$BRANCH" --depth 1 "https://ghproxy.net/${REPO}" "$tmp"
    fi
    [ -d "$APP/server/data" ] && mkdir -p "$tmp/server/data" && cp -a "$APP/server/data/." "$tmp/server/data/" 2>/dev/null || true
    mkdir -p "$APP"
    rsync -a --exclude node_modules --exclude .git "$tmp/" "$APP/"
    rm -rf "$tmp"
    cd "$APP"
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
