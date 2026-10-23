#!/bin/sh
# Boot logic for macOS / Linux (G20). Called by scripts/up.mjs from the repo root, after it
# has created .env.
set -eu
mode="${1:-up}"

compose() { docker compose --env-file .env -f infra/docker-compose.yml "$@"; }

case "$mode" in
  # up builds only missing images (fast restarts); rebuild picks up code changes.
  up) compose up -d --wait ;;
  rebuild) compose up -d --build --wait ;;
  infra) compose up -d --wait postgres object-storage && compose up object-storage-init ;;
  down) compose down ;;
  reset) compose down --volumes && compose up -d --build --wait ;;
  *) echo "Unknown mode: $mode" >&2; exit 2 ;;
esac
