#!/usr/bin/env bash
# VPS setup script for yt-transcribe worker
# Run once on a fresh Ubuntu/Debian server as root or a sudo user.
# Usage: bash scripts/setup-vps.sh

set -euo pipefail

INSTALL_DIR="/opt/yt-transcribe"
DOCKERHUB_USERNAME="${DOCKERHUB_USERNAME:-}"

echo "==> Installing Docker..."
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker "$USER"
  echo "Docker installed. You may need to log out and back in for group changes to take effect."
else
  echo "Docker already installed, skipping."
fi

echo "==> Creating install directory at $INSTALL_DIR..."
sudo mkdir -p "$INSTALL_DIR"
sudo chown "$USER":"$USER" "$INSTALL_DIR"

echo "==> Copying docker-compose.yml..."
cp "$(dirname "$0")/../docker-compose.yml" "$INSTALL_DIR/docker-compose.yml"

echo "==> Setting up .env file..."
if [ ! -f "$INSTALL_DIR/.env" ]; then
  cp "$(dirname "$0")/../.env.example" "$INSTALL_DIR/.env"
  echo ""
  echo "  ⚠️  Fill in your secrets before continuing:"
  echo "     $INSTALL_DIR/.env"
  echo ""
else
  echo ".env already exists, skipping."
fi

if [ -z "$DOCKERHUB_USERNAME" ]; then
  read -rp "Enter your Docker Hub username: " DOCKERHUB_USERNAME
fi
echo "DOCKERHUB_USERNAME=$DOCKERHUB_USERNAME" >> "$INSTALL_DIR/.env"

echo "==> Pulling latest Docker image..."
DOCKERHUB_USERNAME="$DOCKERHUB_USERNAME" docker compose -f "$INSTALL_DIR/docker-compose.yml" pull

echo "==> Installing cron job (every 30 minutes)..."
CRON_JOB="*/30 * * * * DOCKERHUB_USERNAME=$DOCKERHUB_USERNAME docker compose -f $INSTALL_DIR/docker-compose.yml run --rm yt-transcribe >> /var/log/yt-transcribe.log 2>&1"

# Add cron entry only if it doesn't already exist
( crontab -l 2>/dev/null | grep -v "yt-transcribe"; echo "$CRON_JOB" ) | crontab -

echo ""
echo "✅ Setup complete!"
echo ""
echo "  Cron runs every 30 minutes — logs at: /var/log/yt-transcribe.log"
echo "  To run manually:  docker compose -f $INSTALL_DIR/docker-compose.yml run --rm yt-transcribe"
echo "  To view logs:     tail -f /var/log/yt-transcribe.log"
