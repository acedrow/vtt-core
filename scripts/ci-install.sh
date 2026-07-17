#!/usr/bin/env bash
# Install deps in CI / Workers Builds with auth for the private content git dep.
# Set CONTENT_GIT_TOKEN (preferred) to a PAT/fine-grained token with read access
# to acedrow/hellpiercers-content. Falls back to GITHUB_TOKEN when present.
#
# Workers Builds install command: bash scripts/ci-install.sh
# See docs/content-package-private-cutover.md
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

TOKEN="${CONTENT_GIT_TOKEN:-${GITHUB_TOKEN:-}}"
if [[ -n "$TOKEN" ]]; then
  # package.json uses git+https; package-lock may resolve to git+ssh.
  git config --global url."https://x-access-token:${TOKEN}@github.com/".insteadOf "https://github.com/"
  git config --global url."https://x-access-token:${TOKEN}@github.com/".insteadOf "ssh://git@github.com/"
  git config --global url."https://x-access-token:${TOKEN}@github.com/".insteadOf "git+ssh://git@github.com/"
  git config --global url."https://x-access-token:${TOKEN}@github.com/".insteadOf "git@github.com:"
  echo "[ci-install] configured git HTTPS auth for github.com private deps"
elif [[ "${REQUIRE_CONTENT_GIT_TOKEN:-}" == "1" || "${CI:-}" == "true" ]]; then
  echo "[ci-install] CONTENT_GIT_TOKEN is required in CI / Workers Builds" >&2
  echo "Create a read-only PAT for acedrow/hellpiercers-content and set secret CONTENT_GIT_TOKEN." >&2
  echo "See docs/content-package-private-cutover.md" >&2
  exit 1
else
  echo "[ci-install] WARNING: CONTENT_GIT_TOKEN/GITHUB_TOKEN unset — private content fetch may fail" >&2
fi

if [[ -f package-lock.json ]]; then
  npm ci
else
  npm install
fi
