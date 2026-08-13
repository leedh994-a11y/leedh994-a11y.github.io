#!/usr/bin/env bash
# Safe disk cleanup for yoursite.asia ECS
# curl -fsSL https://cdn.jsdelivr.net/gh/leedh994-a11y/leedh994-a11y.github.io@main/scripts/aliyun-disk-cleanup.sh | bash

set -euo pipefail

log() { echo "[cleanup] $*"; }

log "========== BEFORE =========="
df -h / /tmp /opt 2>/dev/null || df -h

log "Remove temp restore dirs..."
rm -rf /tmp/yoursite-restore-* /tmp/yoursite-src-* /tmp/sitefix 2>/dev/null || true

log "Trim systemd journal..."
journalctl --vacuum-size=50M 2>/dev/null || true

log "Clear npm cache..."
npm cache clean --force 2>/dev/null || true
rm -rf /root/.npm/_cacache 2>/dev/null || true

log "Flush pm2 logs..."
pm2 flush 2>/dev/null || true

log "Remove old site backups (keep newest 1)..."
ls -dt /opt/sitegpt.bak.* 2>/dev/null | tail -n +2 | xargs -r rm -rf 2>/dev/null || true

log "Remove stale restore tmp in /opt/sitegpt..."
rm -rf /opt/sitegpt/.restore-tmp 2>/dev/null || true

log "Clear yum/dnf cache..."
yum clean all 2>/dev/null || dnf clean all 2>/dev/null || true

log "Remove old rotated logs..."
find /var/log -type f -name "*.gz" -mtime +7 -delete 2>/dev/null || true
find /var/log -type f -name "*.1" -mtime +7 -delete 2>/dev/null || true

AVAIL_BEFORE="$(df / --output=avail -B1 2>/dev/null | tail -1 | tr -d ' ' || echo 0)"

# Only remove node_modules if still critically low (<150MB)
if [ "${AVAIL_BEFORE:-0}" -lt 157286400 ]; then
  log "Still low — remove node_modules (can npm install later)..."
  rm -rf /opt/sitegpt/node_modules 2>/dev/null || true
fi

log "========== AFTER =========="
df -h / /tmp /opt 2>/dev/null || df -h

AVAIL="$(df / --output=avail -B1 2>/dev/null | tail -1 | tr -d ' ' || echo 0)"
AVAIL_MB=$((AVAIL / 1048576))
log "Free space: ${AVAIL_MB} MB"

if [ "$AVAIL_MB" -ge 200 ]; then
  log "OK — enough space for full restore"
  exit 0
fi

log "WARN — still low. Consider: rm -rf /opt/sitegpt.bak.* or expand ECS disk in Alibaba console"
exit 0
