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
  # actions/checkout persists GITHUB_TOKEN as http.https://github.com/.extraheader.
  # That Authorization header wins over URL-embedded PATs for all github.com HTTPS
  # and cannot read other private repos (hellpiercers-content → "not found").
  git config --local --unset-all http.https://github.com/.extraheader 2>/dev/null || true
  git config --global --unset-all http.https://github.com/.extraheader 2>/dev/null || true
  BASIC="$(printf 'x-access-token:%s' "$TOKEN" | base64 | tr -d '\n')"
  git config --global http.https://github.com/.extraheader "AUTHORIZATION: basic ${BASIC}"
  echo "[ci-install] set github.com HTTP extraheader from CONTENT_GIT_TOKEN"

  # Rewrite lockfile github git URLs to authenticated HTTPS so npm/pacote never
  # needs SSH (and does not depend solely on git insteadOf matching).
  if [[ -f package-lock.json ]]; then
    CONTENT_GIT_TOKEN="$TOKEN" python3 - <<'PY'
import os
from pathlib import Path

token = os.environ["CONTENT_GIT_TOKEN"]
auth = f"https://x-access-token:{token}@github.com/"
p = Path("package-lock.json")
text = p.read_text()
rewritten = (
    text.replace("git+ssh://git@github.com/", f"git+{auth}")
    .replace("ssh://git@github.com/", auth)
    .replace("git+https://github.com/", f"git+{auth}")
    .replace("https://github.com/", auth)
)
# Avoid double-prefix if script is re-run
rewritten = rewritten.replace(
    f"git+https://x-access-token:{token}@github.com/https://x-access-token:{token}@github.com/",
    f"git+https://x-access-token:{token}@github.com/",
)
if rewritten != text:
    p.write_text(rewritten)
    print("[ci-install] injected CONTENT_GIT_TOKEN into package-lock.json github URLs")
else:
    print("[ci-install] package-lock.json github URLs already authenticated or absent")
PY
  fi

  # Also register insteadOf for any non-lockfile git fetches (npm may still probe).
  # Use --add: without it, later insteadOf values overwrite earlier ones.
  AUTH_BASE="https://x-access-token:${TOKEN}@github.com/"
  git config --global --unset-all "url.${AUTH_BASE}.insteadOf" 2>/dev/null || true
  git config --global --add "url.${AUTH_BASE}.insteadOf" "https://github.com/"
  git config --global --add "url.${AUTH_BASE}.insteadOf" "ssh://git@github.com/"
  git config --global --add "url.${AUTH_BASE}.insteadOf" "git+ssh://git@github.com/"
  git config --global --add "url.${AUTH_BASE}.insteadOf" "git+https://github.com/"
  git config --global --add "url.${AUTH_BASE}.insteadOf" "git@github.com:"
  echo "[ci-install] configured git HTTPS auth for github.com private deps"

  # Fail fast with an actionable message if the token cannot read the content repo.
  if ! GIT_TERMINAL_PROMPT=0 git ls-remote "https://github.com/acedrow/hellpiercers-content.git" HEAD >/dev/null 2>&1; then
    echo "[ci-install] CONTENT_GIT_TOKEN cannot read acedrow/hellpiercers-content (git ls-remote failed)." >&2
    echo "Checks: secret name CONTENT_GIT_TOKEN (repo Actions secrets), PAT Contents:Read on hellpiercers-content, no trailing newline in the secret, and this script must clear checkout's GITHUB_TOKEN extraheader." >&2
    echo "See docs/content-package-private-cutover.md" >&2
    exit 1
  fi
  echo "[ci-install] CONTENT_GIT_TOKEN can read acedrow/hellpiercers-content"
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
