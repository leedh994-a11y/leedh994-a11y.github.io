#!/usr/bin/env bash
# Restore / repair all SEO pages under /seo/ (1000+ HTML files)
# curl -fsSL https://cdn.jsdelivr.net/gh/leedh994-a11y/leedh994-a11y.github.io@main/scripts/aliyun-restore-seo.sh | bash

set -euo pipefail

APP="${APP_DIR:-/opt/sitegpt}"
BRANCH="${BRANCH:-main}"
REPO="${REPO:-https://github.com/leedh994-a11y/leedh994-a11y.github.io.git}"
TMP="/var/tmp/yoursite-seo-$$"

log() { echo "[seo-restore] $*"; }

count_seo() {
  find "$1/seo" -name '*.html' 2>/dev/null | wc -l | tr -d ' '
}

main() {
  [ "$(id -u)" -eq 0 ] || { echo "请用 root 运行"; exit 1; }

  echo "========== SEO 页面补全 =========="
  command -v git >/dev/null 2>&1 || yum install -y git 2>/dev/null || dnf install -y git
  command -v rsync >/dev/null 2>&1 || yum install -y rsync 2>/dev/null || dnf install -y rsync

  mkdir -p "$APP/seo"
  BEFORE="$(count_seo "$APP")"
  log "当前 SEO 页数: $BEFORE"

  rm -rf "$TMP"
  mkdir -p "$TMP"
  log "Sparse clone seo/ only (branch $BRANCH)..."
  cd "$TMP"
  git init -q
  git remote add origin "$REPO"
  git config core.sparseCheckout true
  echo "seo/" > .git/info/sparse-checkout
  if ! git pull --depth 1 origin "$BRANCH" 2>/dev/null; then
    log "GitHub slow — try mirror..."
    git remote set-url origin "https://ghproxy.net/${REPO}"
    git pull --depth 1 origin "$BRANCH"
  fi

  SRC_COUNT="$(count_seo "$TMP")"
  log "仓库 SEO 页数: $SRC_COUNT"

  log "Sync seo/ -> $APP/seo/ (merge, no delete)..."
  rsync -a "$TMP/seo/" "$APP/seo/"

  rm -rf "$TMP"
  AFTER="$(count_seo "$APP")"
  log "补全后 SEO 页数: $AFTER"

  if [ "$AFTER" -ge "$((SRC_COUNT - 5))" ]; then
    log "SEO 页面已补全 ($AFTER / $SRC_COUNT)"
    SAMPLE="$(find "$APP/seo" -name 'website-ai-assistant-finance.html' | head -1)"
    if [ -n "$SAMPLE" ]; then
      log "样例文件: $SAMPLE"
    fi
    exit 0
  fi

  log "WARN: 仍缺页 ($AFTER / $SRC_COUNT)，尝试完整 clone..."
  TMP2="/var/tmp/yoursite-seo-full-$$"
  rm -rf "$TMP2"
  git clone -b "$BRANCH" --depth 1 --filter=blob:none --sparse "$REPO" "$TMP2"
  cd "$TMP2"
  git sparse-checkout set seo
  rsync -a "$TMP2/seo/" "$APP/seo/"
  rm -rf "$TMP2"
  AFTER="$(count_seo "$APP")"
  log "最终 SEO 页数: $AFTER / $SRC_COUNT"
  [ "$AFTER" -ge "$((SRC_COUNT - 5))" ] && log "SEO 补全完成" || log "仍不完整 — 检查磁盘: df -h /"
}

main "$@"
