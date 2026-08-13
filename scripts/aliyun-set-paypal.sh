#!/usr/bin/env bash
# Set PayPal credentials in /opt/sitegpt/.env and restart pm2
#
# Usage (Alibaba Workbench, root) — secret already on server:
#   bash -c "$(curl -fsSL https://cdn.jsdelivr.net/gh/leedh994-a11y/leedh994-a11y.github.io@main/scripts/aliyun-set-paypal.sh)"
#
# Or pass both inline:
#   PAYPAL_CLIENT_ID=xxx PAYPAL_CLIENT_SECRET=xxx bash -c "$(curl -fsSL .../aliyun-set-paypal.sh)"

set -euo pipefail

APP="${APP_DIR:-/opt/sitegpt}"
PORT="${PORT:-3456}"
DEFAULT_CLIENT_ID="BAA_HhKZAA-3hl-Bx67hXC5snkRbipDaPzkWGBvcZKYwpYe9IQAVSrdtkHmtwTmsN2YPBZDpkVb9RHc3eU"

log() { echo "[set-paypal] $*"; }

set_env_var() {
  local file="$1"
  local name="$2"
  local value="$3"
  touch "$file"
  if grep -q "^${name}=" "$file" 2>/dev/null; then
    sed -i "s|^${name}=.*|${name}=${value}|" "$file"
  else
    echo "${name}=${value}" >> "$file"
  fi
}

main() {
  [ "$(id -u)" -eq 0 ] || { echo "请用 root 运行 / Run as root"; exit 1; }
  [ -d "$APP" ] || { echo "目录不存在: $APP"; exit 1; }

  local client_id="${PAYPAL_CLIENT_ID:-$DEFAULT_CLIENT_ID}"
  local client_secret="${PAYPAL_CLIENT_SECRET:-}"
  local mode="${PAYPAL_MODE:-live}"

  if [ -z "$client_secret" ] && [ -f "$APP/.env" ]; then
    client_secret="$(grep -E '^PAYPAL_CLIENT_SECRET=' "$APP/.env" | cut -d= -f2- || true)"
  fi

  [ -n "$client_id" ] || { echo "缺少 PAYPAL_CLIENT_ID"; exit 1; }
  [ -n "$client_secret" ] || {
    echo "缺少 PAYPAL_CLIENT_SECRET（请通过环境变量传入，或确保 $APP/.env 中已有）"
    exit 1
  }

  log "Writing PayPal config to $APP/.env"
  set_env_var "$APP/.env" "PAYPAL_CLIENT_ID" "$client_id"
  set_env_var "$APP/.env" "PAYPAL_CLIENT_SECRET" "$client_secret"
  set_env_var "$APP/.env" "PAYPAL_MODE" "$mode"

  if command -v pm2 >/dev/null 2>&1 && pm2 describe sitegpt >/dev/null 2>&1; then
    log "Restart pm2 sitegpt..."
    pm2 restart sitegpt
    pm2 save 2>/dev/null || true
    sleep 2
  else
    log "WARN: pm2 sitegpt not found — restart manually"
  fi

  log "PayPal config:"
  curl -sf "http://127.0.0.1:${PORT}/api/paypal/config" 2>/dev/null || true
  echo
  log "PayPal status:"
  curl -sf "http://127.0.0.1:${PORT}/api/paypal/status" 2>/dev/null || true
  echo
}

main "$@"
