#!/usr/bin/env bash
# Wrapper — delegates to full nuke restore (works in China via jsDelivr)
#   curl -fsSL https://cdn.jsdelivr.net/gh/leedh994-a11y/leedh994-a11y.github.io@cursor/yoursite-order-notify-fd54/scripts/aliyun-fix-502.sh | bash

set -euo pipefail

CDN="https://cdn.jsdelivr.net/gh/leedh994-a11y/leedh994-a11y.github.io@cursor/yoursite-order-notify-fd54/scripts/aliyun-nuke-restore.sh"
RAW="https://raw.githubusercontent.com/leedh994-a11y/leedh994-a11y.github.io/cursor/yoursite-order-notify-fd54/scripts/aliyun-nuke-restore.sh"

if curl -fsSL "$CDN" | bash; then
  exit 0
fi

echo "[fix-502] CDN failed, trying GitHub raw..."
curl -fsSL "$RAW" | bash
