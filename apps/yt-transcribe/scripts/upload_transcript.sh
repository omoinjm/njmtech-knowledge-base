#!/bin/bash
set -e

TRANSCRIPT_FILE="/tmp/njmtech-yt-transcribe/youtube/transcript.txt"
API_TOKEN="9kKAtYdMCgmGrMAVS818vnOkoHfDZkc9i"

curl -X POST \
  -H "Authorization: Bearer $API_TOKEN" \
  -F "file=@${TRANSCRIPT_FILE}" \
  https://njmtech-blob.vercel.app/api/v1/blob/upload | jq
