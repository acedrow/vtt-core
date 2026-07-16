# Private content package cutover

In-repo strangler: `packages/hellpiercers-content` (`@gaem/hellpiercers-content`).

## Exports (stable)

| Export | Used by |
|--------|---------|
| `@gaem/hellpiercers-content/register` | Express, CF Worker, DO, client (catalogs + combat + campaign); built `dist/` |
| `@gaem/hellpiercers-content/register-client` | Vue client only (themes, panels); source TS entry today |
| `@gaem/hellpiercers-content/tiles` | Client tile glob/label passthroughs; source TS entry today |
| `@gaem/hellpiercers-content/combat-ui` | Client combat UI helpers (swarm/Yadathan/Gorgenaut/etc.); source TS entry today |

Content **peerDepends** on `@gaem/shared` and `@gaem/client` (Vue panels). Private cutover must keep that peer graph or invert SFC ownership.

## Prerequisites before deleting the workspace copy

1. **No content → client relative imports** — `rg '\.\./\.\./\.\./client' packages/hellpiercers-content` must be empty. Content uses `@gaem/client` package exports for the client contribution API.
2. **Panels / theme CSS / tile globs colocated in content** — Vite `import.meta.glob` modules live next to files they match under the content package (or content-owned paths). Do not leave brace-list globs in `@gaem/client` pointing at sibling content trees only.
3. **Shared has no content dependency** — `@gaem/shared/package.json` does not list `@gaem/hellpiercers-content`.
4. **Grep acceptance** (legal / IP posture) — see below.

## Grep acceptance (engine tree)

Run from repo root after peels. **Allowed always:** fixture/test neutral names; product (`client`/`server`/`cf-worker` boots) and `packages/hellpiercers-content/**`. Opaque combat module keys inside pack registration are fine.

| Check | Expect |
|-------|--------|
| HP JSON under `packages/shared` | No catalog JSON (`packages/shared/src/data/**` empty or absent) |
| Rulebook / PDF tooling under shared or engine scripts | None (lives under content `rulebook/`) |
| Art under `packages/shared` | None |
| `paracletus` / `syncrasis` / `hellpiercers` in `packages/shared/src` (excluding `**/*.test.ts`) | Prefer zero in non-test production TS |
| Content relative import of client | Zero matches for `../../../client` under content package |

Example commands:

```bash
# Orphan catalog JSON in shared
find packages/shared/src/data -type f ! -name '.DS_Store' 2>/dev/null | wc -l
# Should be 0

# Content must not reach into client via relative paths
rg '\.\./\.\./\.\./client' packages/hellpiercers-content || true

# Shared must not depend on content package
! rg -q '@gaem/hellpiercers-content' packages/shared/package.json
```

## Grep sign-off (2026-07-16, Area #1 Open B exit)

| Check | Result |
|-------|--------|
| HP JSON under `packages/shared/src/data` | **0 files** (directory absent) |
| Content → client relative imports | **None** |
| `@gaem/hellpiercers-content` in `packages/shared/package.json` | **Absent** |
| Shared Vitest setup HP register | **Fixture-only** |
| `paracletus` / `syncrasis` / `hellpiercers` in shared non-test production TS | **None** (`"HELLPIERCERS"` removed from `rule-text.ts`; term lives in content game-terms) |
| IP-named combat facade files under `packages/shared/src/combat/` | **0** (retired; modules via `CombatHookContribution.modules`) |
| `content-combat-install.ts` / `ContentCombatKey` | **Removed** |

Private remote cutover remains a separate step (create private repo / auth / replace workspace folder).

## Cutover steps

1. Create a **private** git repo (or GitHub Packages publish) from `packages/hellpiercers-content`.
2. In the engine root `package.json` / workspace consumers, replace the workspace folder with e.g. `"@gaem/hellpiercers-content": "git+ssh://git@github.com/ORG/hellpiercers-content.git#semver:^0.0.1"` or a `file:../hellpiercers-content` path during migration.
3. Keep the same package `name` and `exports` so boots and wrangler aliases need only path updates.
4. **Workers Builds / CI auth** — configure a deploy key or `.npmrc` token so `npm install` can fetch the private dependency. Validate with a dry-run build before deleting the workspace copy.
5. Update wrangler `[alias]` if the content package is no longer a sibling path (prefer installing to `node_modules` and aliasing that entry, or building content before the worker bundle).
6. Re-run grep acceptance above.

## Non-goals

- Runtime-downloaded packs, hot-reload, multi-pack
- New deploy platforms beyond existing `deploy:cf`
- Sheet/pack-version KV migrations (parent #7). Nested `GameState.campaign` (parent #2, see ADR 003) is done — not a private-cutover blocker.
