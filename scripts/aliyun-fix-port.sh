#!/usr/bin/env bash
# Fix nginx 3456 vs app port mismatch — yoursite.asia 502
# curl -fsSL https://cdn.jsdelivr.net/gh/leedh994-a11y/leedh994-a11y.github.io@main/scripts/aliyun-fix-port.sh | bash

set -euo pipefail

APP="${APP_DIR:-/opt/sitegpt}"
PORT="3456"

log() { echo "[fix-port] $*"; }

main() {
  [ "$(id -u)" -eq 0 ] || { echo "请用 root 运行"; exit 1; }
  [ -d "$APP" ] || { echo "Missing $APP"; exit 1; }

  echo "========== 修复端口 3456 =========="
  log "nginx -> 127.0.0.1:3456"

  if [ -f "$APP/.env" ]; then
    grep -q '^PORT=' "$APP/.env" && sed -i 's/^PORT=.*/PORT=3456/' "$APP/.env" || echo 'PORT=3456' >> "$APP/.env"
  else
    echo -e "PORT=3456\nPUBLIC_URL=https://yoursite.asia" > "$APP/.env"
  fi

  pm2 delete sitegpt sitp-gpt 2>/dev/null || true

  if [ -f "$APP/server/index.js" ]; then
    log "Start server/index.js on :3456"
    PORT=3456 pm2 start "$APP/server/index.js" --name sitegpt --cwd "$APP" --update-env
  elif [ -f "$APP/server/emergency.cjs" ]; then
    log "Start emergency.cjs on :3456"
    PORT=3456 pm2 start "$APP/server/emergency.cjs" --name sitegpt --cwd "$APP" --update-env
  elif [ -f "$APP/server.js" ]; then
    log "Start server.js on :3456"
    PORT=3456 pm2 start "$APP/server.js" --name sitegpt --cwd "$APP" --update-env
  else
    echo "No server entry found in $APP"; exit 1
  fi

  pm2 save 2>/dev/null || true
  sleep 3

  ss -tlnp | grep ':3456 ' || true
  curl -s "http://127.0.0.1:3456/api/health" 2>/dev/null || curl -s -o /dev/null -w "GET / => %{http_code}\n" "http://127.0.0.1:3456/"
  PUB="$(curl -s -o /dev/null -m 10 -w '%{http_code}' https://yoursite.asia/ 2>/dev/null || echo 000)"
  log "Public https://yoursite.asia => HTTP $PUB"

  if [ "$PUB" = "200" ] || [ "$PUB" = "301" ]; then
    log "网站已恢复！"
  else
    log "本地3456已启动但公网仍 $PUB — 发我 pm2 logs sitegpt --lines 20"
  fi
}

main "$@"
