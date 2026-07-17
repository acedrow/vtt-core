# Private content package cutover

**Status (2026-07-17):** Phase C **done**. Phase 6A CI auth **done** (`scripts/ci-install.sh` + `CONTENT_GIT_TOKEN` set in GitHub Actions and Workers Builds). `@gaem/hellpiercers-content` is a private git dependency (`acedrow/hellpiercers-content` @ `semver:^0.0.6`). In-tree `packages/hellpiercers-content` removed. Local checkout of the content repo: `/Users/lindenholt/code/hellpiercers-content`.

## Locked topology decisions

| Decision | Choice |
|----------|--------|
| Product home | Stays in the engine repo (`client` / `server` / `cf-worker` boots) |
| Content home | Private git repo `acedrow/hellpiercers-content` |
| Publish mechanism | Private **git** dependency with **semver tags** (not GitHub Packages, not submodule) |
| Dep spec (product) | `git+https://github.com/acedrow/hellpiercers-content.git#semver:^0.0.6` (HTTPS; SSH needs host-key setup) |
| Local sibling dry-run | `file:../../../hellpiercers-content` from `packages/{client,server,cf-worker}` |
| Path resolution | `scripts/content-package-root.mjs` + `require.resolve("@gaem/hellpiercers-content/package.json")` |
| Build content | `npm run build:content` → `scripts/build-content.mjs` (engine TypeScript) |
| Wrangler register alias | `../../node_modules/@gaem/hellpiercers-content/src/register.ts` |
| Vite | `optimizeDeps.exclude` content exports so `register-client` shares `@gaem/client/content-pack` (no dual registry) |
| Peers | Not declared on content (npm arborist cannot resolve private workspace peers during git prep). Expected: `@gaem/shared`, `@gaem/client`, `vue` — see content README |
| Build / sync contract | [content-package-build-contract.md](content-package-build-contract.md) |
| CI install | `bash scripts/ci-install.sh` + secret `CONTENT_GIT_TOKEN` |

## Exports (stable)

| Export | Used by |
|--------|---------|
| `@gaem/hellpiercers-content/package.json` | Package-root resolution for maps/assets/scripts |
| `@gaem/hellpiercers-content/register` | Express, CF Worker, DO, client; built `dist/` in exports; wrangler aliases **source** |
| `@gaem/hellpiercers-content/register-client` | Vue client only; source TS |
| `@gaem/hellpiercers-content/tiles` | Client tile globs/labels; source TS |
| `@gaem/hellpiercers-content/combat-ui` | Client combat UI helpers; source TS |

## Engine scripts

| Script | Purpose |
|--------|---------|
| `npm run build:content` | `tsc -b` content package via engine TypeScript |
| `npm run dev:content` | content `tsc --watch` |
| `npm run rulebook` / `rulebook:setup` | Resolve content package root, then rulebook tooling |
| `bash scripts/ci-install.sh` | Auth + `npm ci` for private content (needs `CONTENT_GIT_TOKEN` in CI) |

HP behavioral Vitest suites run in the **content repo**, not engine `npm test`.

## Private-git CI auth (Phase 6A)

**Chosen mechanism:** HTTPS token via secret `CONTENT_GIT_TOKEN` + [`scripts/ci-install.sh`](../scripts/ci-install.sh). The script rewrites `https://`, `ssh://`, `git+ssh://`, and `git@host:` URLs for `github.com` to `https://x-access-token:…@github.com/…` so both `package.json` and the lockfile resolve, then runs `npm ci`.

### 1. Create a token

Prefer a **fine-grained PAT** (or classic PAT / machine-user token) with **Contents: Read** on `acedrow/hellpiercers-content` only. Do not commit the token.

### 2. GitHub Actions (`vtt-core`)

1. Repo **Settings → Secrets and variables → Actions**
2. Add secret `CONTENT_GIT_TOKEN` = the PAT
3. Workflows call `bash scripts/ci-install.sh` before build ([`verify.yml`](../.github/workflows/verify.yml), [`deploy-cloudflare.yml`](../.github/workflows/deploy-cloudflare.yml))
4. Optional dry-run: [`content-git-auth.yml`](../.github/workflows/content-git-auth.yml) stops after `npm ci`

### 3. Cloudflare Workers Builds (primary deploy)

1. Open the Worker → **Settings → Builds**
2. Add **build secret**: `CONTENT_GIT_TOKEN` = same PAT
3. Set **install command** to:

```bash
bash scripts/ci-install.sh
```

4. Deploy uses wrangler; `[build]` runs [`scripts/cf-wrangler-build.sh`](../scripts/cf-wrangler-build.sh) which builds shared + content + client and runs **`sync-maps`** to remote `MAP_KV` (see [build contract](content-package-build-contract.md)).

Also ensure Cloudflare API credentials are available to Workers Builds. Runtime secrets remain `wrangler secret put`: `GM_PASSWORD`, `PLAYER_PASSWORD`, `AUTH_SECRET`, optional `RANDOM_ORG_API_KEY`.

Manual GHA deploy (optional): [`deploy-cloudflare.yml`](../.github/workflows/deploy-cloudflare.yml) needs `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` in addition to `CONTENT_GIT_TOKEN`.

### 4. SSH deploy key (alternative; not default)

If you prefer SSH instead of a PAT:

1. Generate a read-only deploy key on `acedrow/hellpiercers-content`
2. Load the private key into the CI agent
3. Ensure `known_hosts` includes `github.com`
4. Prefer aligning lockfile resolution to `git+ssh://…` and skip the HTTPS rewrite

Default CI path stays **HTTPS + `CONTENT_GIT_TOKEN` + `ci-install.sh`**.

### 5. Local developers

Local installs usually use SSH agent or a logged-in `gh` credential helper. Sibling dry-run: set product deps to `file:../../../hellpiercers-content`.

## Grep acceptance (engine tree)

**Allowed:** fixture/test neutral names; product boots; installed content under `node_modules/@gaem/hellpiercers-content`.

```bash
find packages/shared/src/data -type f ! -name '.DS_Store' 2>/dev/null | wc -l   # 0
! rg -q '@gaem/hellpiercers-content' packages/shared/package.json
test ! -d packages/hellpiercers-content
```

### Sign-off (2026-07-17, Phase C)

| Check | Result |
|-------|--------|
| Workspace `packages/hellpiercers-content` | **Removed** |
| Product deps | **git+https … #semver:^0.0.6** |
| Shared content dep | **Absent** |
| Shared catalog JSON | **0 files** |
| `npm run build` / `test` / `lint` / `test:e2e` | **Green** |

## Phase C checklist

1. ~~Create private repo + tag~~ `acedrow/hellpiercers-content` `v0.0.5`
2. ~~Standalone content tsconfig~~ (no monorepo extends/references)
3. ~~Product deps → git dep; remove workspace copy~~
4. ~~Root/`cf-wrangler-build`/`ensure-shared-built` → `build:content`~~
5. ~~Vite `optimizeDeps.exclude` for content exports~~
6. ~~Workers Builds / CI auth~~ `scripts/ci-install.sh` + workflows + `CONTENT_GIT_TOKEN` in GitHub Actions and Workers Builds
7. ~~Grep acceptance / full verify~~

## Non-goals

- GitHub Packages registry
- Inverting Vue SFCs into `@gaem/client`
- Runtime-downloaded packs, hot-reload, multi-pack
- ~~Sheet/pack-version KV migrations (parent #7)~~ done in engine; publish content ≥0.0.6 for `sheetDataKeys`
