#!/usr/bin/env bash
# One-time (or after Playwright upgrades) e2e browser + env setup.
# Browsers install under packages/e2e/.playwright-browsers so they survive
# Cursor sandbox temp caches and don't need re-downloading every run.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# Always pin to the in-repo cache. Cursor's agent sandbox pre-sets
# PLAYWRIGHT_BROWSERS_PATH to a wiped temp dir; do not inherit that.
export PLAYWRIGHT_BROWSERS_PATH="$ROOT/packages/e2e/.playwright-browsers"

mkdir -p "$PLAYWRIGHT_BROWSERS_PATH"

if [[ ! -f "$ROOT/.env.e2e" ]]; then
  cp "$ROOT/.env.e2e.example" "$ROOT/.env.e2e"
  echo "Created .env.e2e from .env.e2e.example"
fi

cd "$ROOT"
npm run playwright:install -w @gaem/e2e

echo "Playwright Chromium ready at $PLAYWRIGHT_BROWSERS_PATH"
echo "Run e2e with: npm run test:e2e  (client :5174, API :3002 — safe alongside dev:cf)"
