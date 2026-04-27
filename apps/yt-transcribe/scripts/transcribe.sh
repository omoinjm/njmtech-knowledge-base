#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$(dirname "$SCRIPT_DIR")"

LINK="https://www.youtube.com/watch?v=rdWZo5PD9Ek"
# LINK="https://www.instagram.com/reel/DTQNaqBE0zw/?utm_source=ig_web_copy_link&igsh=MzRlODBiNWFlZA=="
OUTPUT_DIR="/tmp/njmtech-yt-transcribe/"

./yt-transcribe -url $LINK -output $OUTPUT_DIR
