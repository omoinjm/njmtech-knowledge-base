#!/bin/sh
# entrypoint.sh - Manages cron scheduling and application startup

# Create crontab for running yt-transcribe every 15 minutes
# Output is piped to tee so it appears in docker logs AND a log file
CRONTAB_CONTENT="*/15 * * * * /usr/local/bin/yt-transcribe -db 2>&1 | tee -a /tmp/yt-transcribe.log"

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
