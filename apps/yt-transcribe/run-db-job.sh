#!/bin/sh
set -eu

LOCK_DIR="/tmp/yt-transcribe-db.lock"

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Previous job still running; skipping this cron tick."
  exit 0
fi

cleanup() {
  rmdir "$LOCK_DIR" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

/usr/local/bin/yt-transcribe -db
