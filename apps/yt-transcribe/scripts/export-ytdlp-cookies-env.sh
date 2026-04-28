#!/bin/sh
set -eu

COOKIE_FILE="${1:-docs/www.youtube.com_cookies.txt}"
CHUNK_SIZE="${CHUNK_SIZE:-30000}"

if [ ! -f "$COOKIE_FILE" ]; then
  echo "Cookie file not found: $COOKIE_FILE" >&2
  exit 1
fi

base64 -w0 "$COOKIE_FILE" | fold -w "$CHUNK_SIZE" | awk '
  {
    printf "YT_DLP_COOKIES_CONTENT_PART%d=%s\n", NR, $0
  }
'
