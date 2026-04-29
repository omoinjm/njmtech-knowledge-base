#!/bin/sh
# entrypoint.sh - Manages cron scheduling and application startup

# Materialize yt-dlp cookies from env into a runtime file for headless/container environments.
# Supported inputs (highest priority first):
# 1) YT_DLP_COOKIES_CONTENT_B64 (base64-encoded cookies file contents)
# 2) YT_DLP_COOKIES_CONTENT_PART1..PART9 (plain-text chunks concatenated in order)
# 3) YT_DLP_COOKIES_CONTENT (plain-text full contents)
COOKIES_CONTENT=""
if [ -n "${YT_DLP_COOKIES_CONTENT_B64:-}" ]; then
  COOKIES_CONTENT="$(printf "%s" "$YT_DLP_COOKIES_CONTENT_B64" | base64 -d 2>/dev/null || true)"
elif [ -n "${YT_DLP_COOKIES_CONTENT_PART1:-}" ]; then
  COOKIES_CONTENT="${YT_DLP_COOKIES_CONTENT_PART1:-}${YT_DLP_COOKIES_CONTENT_PART2:-}${YT_DLP_COOKIES_CONTENT_PART3:-}${YT_DLP_COOKIES_CONTENT_PART4:-}${YT_DLP_COOKIES_CONTENT_PART5:-}${YT_DLP_COOKIES_CONTENT_PART6:-}${YT_DLP_COOKIES_CONTENT_PART7:-}${YT_DLP_COOKIES_CONTENT_PART8:-}${YT_DLP_COOKIES_CONTENT_PART9:-}"
elif [ -n "${YT_DLP_COOKIES_CONTENT:-}" ]; then
  COOKIES_CONTENT="${YT_DLP_COOKIES_CONTENT}"
fi

if [ -n "$COOKIES_CONTENT" ]; then
  COOKIE_PATH="/tmp/yt-cookies.txt"
  printf "%s\n" "$COOKIES_CONTENT" > "$COOKIE_PATH"
  chmod 600 "$COOKIE_PATH"
  export YT_DLP_COOKIES_FILE="$COOKIE_PATH"
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] YT_DLP_COOKIES_FILE configured at $COOKIE_PATH"
fi

# Create crontab for running yt-transcribe every 15 minutes
# Output is piped to tee so it appears in docker logs AND a log file
CRONTAB_CONTENT="*/15 * * * * /usr/local/bin/run-db-job.sh 2>&1 | tee -a /tmp/yt-transcribe.log"

# Write crontab to the default cron directory
echo "$CRONTAB_CONTENT" | crontab -

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Cron daemon starting - yt-transcribe will run every 15 minutes"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Job output will appear below:"
echo "-------------------------------------------"

# Start the cron daemon in the foreground
# -f: foreground mode (required for Docker)
# -l 2: log level 2 (include job execution logs)
exec crond -f -l 2 2>&1

# Note: exec crond -f does not return, so the container will keep running
# To stop the container, send SIGTERM (docker stop) or SIGINT (Ctrl+C)
