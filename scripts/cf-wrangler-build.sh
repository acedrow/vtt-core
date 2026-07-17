#!/usr/bin/env bash
set -euo pipefail

# dev: the client is served by the Vite dev server (HMR) and shared is bundled
# from source via [alias], so this build is a no-op. dev:cf builds the client once
# up front only so the ASSETS directory exists when wrangler starts.
if [ "${WRANGLER_COMMAND:-}" = "dev" ]; then
  echo "[cf dev] client served by Vite dev server; skipping build"
else
  npm run build -w @gaem/shared && npm run build:content && npm run build -w @gaem/client
  # Keep MAP_KV in sync on every deploy path (bare wrangler deploy / Workers Builds).
  npm run sync-maps -w @gaem/cf-worker
fi
