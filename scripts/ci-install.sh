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
  # Prefer rewriting lockfile SSH resolves to HTTPS so npm never invokes ssh://.
  if [[ -f package-lock.json ]]; then
    python3 - <<'PY'
from pathlib import Path
p = Path("package-lock.json")
text = p.read_text()
rewritten = (
    text.replace("git+ssh://git@github.com/", "git+https://github.com/")
    .replace("ssh://git@github.com/", "https://github.com/")
)
if rewritten != text:
    p.write_text(rewritten)
    print("[ci-install] rewrote package-lock.json github SSH URLs to HTTPS")
PY
  fi

  # Use --add: each url.<base>.insteadOf without --add overwrites the previous
  # value for that same base, which left only git@github.com: and broke ssh://.
  AUTH_BASE="https://x-access-token:${TOKEN}@github.com/"
  git config --global --unset-all "url.${AUTH_BASE}.insteadOf" 2>/dev/null || true
  git config --global --add "url.${AUTH_BASE}.insteadOf" "https://github.com/"
  git config --global --add "url.${AUTH_BASE}.insteadOf" "ssh://git@github.com/"
  git config --global --add "url.${AUTH_BASE}.insteadOf" "git+ssh://git@github.com/"
  git config --global --add "url.${AUTH_BASE}.insteadOf" "git+https://github.com/"
  git config --global --add "url.${AUTH_BASE}.insteadOf" "git@github.com:"
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
