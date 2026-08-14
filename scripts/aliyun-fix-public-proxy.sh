#!/usr/bin/env bash
# Find and fix public proxy -> port 3000 for mail relay
# bash -c "$(curl -fsSL https://cdn.jsdelivr.net/gh/leedh994-a11y/leedh994-a11y.github.io@main/scripts/aliyun-fix-public-proxy.sh)"

set -euo pipefail

log() { echo "[fix-proxy] $*"; }

main() {
  [ "$(id -u)" -eq 0 ] || { echo "Run as root"; exit 1; }

  log "Listening ports:"
  ss -tlnp | grep -E ':80|:443|:3000|:3456' || true

  log "Local mail relay checks:"
  curl -sf http://127.0.0.1:3000/api/mail/relay/status && echo " (3000 OK)" || echo "3000 FAIL"
  curl -sf http://127.0.0.1:3456/api/mail/relay/status && echo " (3456 OK)" || echo "3456 FAIL"

  if command -v docker >/dev/null 2>&1; then
    log "Docker containers:"
    docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}' || true
    for c in $(docker ps -q 2>/dev/null); do
      name=$(docker inspect -f '{{.Name}}' "$c" | tr -d '/')
      log "Inspect $name nginx config..."
      docker exec "$c" sh -c 'grep -r proxy_pass /etc/nginx/ 2>/dev/null | head -5' 2>/dev/null || true
      docker exec "$c" sh -c 'sed -i "s/127\.0\.0\.1:3456/127.0.0.1:3000/g; s/127\.0\.0\.1:3000/127.0.0.1:3000/g" /etc/nginx/nginx.conf /etc/nginx/conf.d/*.conf 2>/dev/null; nginx -s reload 2>/dev/null || true' 2>/dev/null || true
    done
  else
    log "Docker not installed"
  fi

  for ngx in /usr/sbin/nginx /usr/local/nginx/sbin/nginx /opt/nginx/sbin/nginx; do
    [ -x "$ngx" ] && log "Found nginx: $ngx" && "$ngx" -t 2>/dev/null && "$ngx" -s reload 2>/dev/null || true
  done

  log "Public check:"
  curl -sf https://yoursite.asia/api/mail/relay/status || echo "STILL FAILING — update Aliyun SLB backend port to 3000 in console"
  echo
}

main "$@"
