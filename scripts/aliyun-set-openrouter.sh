#!/usr/bin/env bash
# Set OPENROUTER_API_KEY in /opt/sitegpt/.env and restart pm2
#
# Usage (Alibaba Workbench, root):
#   OPENROUTER_API_KEY=sk-or-v1-YOUR_KEY bash -c "$(curl -fsSL https://cdn.jsdelivr.net/gh/leedh994-a11y/leedh994-a11y.github.io@main/scripts/aliyun-set-openrouter.sh)"
#
# Optional:
#   OPENROUTER_MODEL=openai/gpt-4o-mini
#   OPENROUTER_SITE_URL=https://yoursite.asia

set -euo pipefail

APP="${APP_DIR:-/opt/sitegpt}"
PORT="${PORT:-3456}"
KEY="${OPENROUTER_API_KEY:-}"

log() { echo "[set-openrouter] $*"; }

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
  [ -n "$KEY" ] || {
    echo "缺少 OPENROUTER_API_KEY"
    echo "示例: OPENROUTER_API_KEY=sk-or-v1-xxx bash -c \"\$(curl -fsSL .../aliyun-set-openrouter.sh)\""
    exit 1
  }
  [ -d "$APP" ] || { echo "目录不存在: $APP"; exit 1; }

  log "Writing OPENROUTER_API_KEY to $APP/.env"
  set_env_var "$APP/.env" "OPENROUTER_API_KEY" "$KEY"

  if [ -n "${OPENROUTER_MODEL:-}" ]; then
    set_env_var "$APP/.env" "OPENROUTER_MODEL" "$OPENROUTER_MODEL"
  fi
  if [ -n "${OPENROUTER_SITE_URL:-}" ]; then
    set_env_var "$APP/.env" "OPENROUTER_SITE_URL" "$OPENROUTER_SITE_URL"
  fi
  if [ -n "${OPENROUTER_SITE_NAME:-}" ]; then
    set_env_var "$APP/.env" "OPENROUTER_SITE_NAME" "$OPENROUTER_SITE_NAME"
  fi

  if command -v pm2 >/dev/null 2>&1 && pm2 describe sitegpt >/dev/null 2>&1; then
    log "Restart pm2 sitegpt..."
    pm2 restart sitegpt
    pm2 save 2>/dev/null || true
    sleep 2
  else
    log "WARN: pm2 sitegpt not found — restart manually after deploy"
  fi

  if curl -sf "http://127.0.0.1:${PORT}/api/openrouter/config" 2>/dev/null; then
    echo
    log "OpenRouter config check done"
  else
    log "WARN: could not reach http://127.0.0.1:${PORT}/api/openrouter/config"
  fi
}

main "$@"
