#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$(dirname "$SCRIPT_DIR")"

echo "Building..."
go build -a -v -o yt-transcribe
echo ""

sleep 3

echo "Running tests..."
go test -v ./
