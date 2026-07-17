# AGENTS.md

Guidance for AI coding agents working in this repository.

## Project

**vtt-core** — browser-based tactical grid VTT engine (GM/player roles, character sheets, real-time board sync). Dual backends (local Express + Cloudflare Worker/Durable Object).

Monorepo (npm workspaces). Node 22 (`nvm use`).

| Package | Purpose |
|---------|---------|
| `@gaem/shared` | Types, map parsing, game rules, combat framework, content-pack registries |
| `@gaem/hellpiercers-content` | Private git dep — Hellpiercers catalogs, combat, assets, maps, rulebook, client UI |
| `@gaem/client` | Vue 3 SPA — board, panels, session flow |
| `@gaem/server` | Local dev — Express REST + in-memory WebSocket game room |
| `@gaem/cf-worker` | Production — Cloudflare Worker, Durable Object game room, KV, R2 |

npm package scope is still `@gaem/*` (historical); do not rename packages unless explicitly asked.

**Rule of thumb:** game logic and validation belong in `@gaem/shared`. Both `server` and `cf-worker` must call the same shared functions so local dev matches production.

### Engine vs content

This repo is the **engine / product shell**. Hellpiercers IP lives in the private git package `@gaem/hellpiercers-content` (`acedrow/hellpiercers-content`), installed into `node_modules` and registered at product boot. Local content checkout: `/Users/lindenholt/code/hellpiercers-content`.

| Belongs in engine (keep / generalize) | Belongs in content pack (extract) |
|---------------------------------------|-----------------------------------|
| Auth, WS/REST, DO room, map CRUD | (engine packages — not content catalogs) |
| Grid/map/combat *framework* | Named modules in `combat/` (e.g. `lurking-freak`, `stainwalk`, `kopis`) |
| Generic UI shell (`GameBoard`, `PanelShell`, …) | HP panels (Overworld, Factions, Base Upgrades), themes, branding |
| Sheet/profile persistence | Pack extras under `Player`/`CharacterSheet.data`; campaign under `GameState.campaign` |
| E2e harness + fixture packs | HP-specific e2e scenarios, content-package art, rulebook PDF/docs |

**Composition:**
1. Content is a private **git** dependency (`#semver:^0.0.6`), registered at **build/boot** (not runtime KV packs).
2. Ability code lives in content via the plugin/registry API.

**Plans:** [content_engine_split](.cursor/plans/content_engine_split_077e8cba.plan.md), [content_pack_contract](.cursor/plans/content_pack_contract_ca112cb6.plan.md), [private cutover](docs/content-package-private-cutover.md).

Sibling historical tree: `/Users/lindenholt/code/gaem`. Engine Vitest uses the fixture pack; HP suites run in the content repo.

## Commands

```bash
npm install
npm run e2e:setup      # once: .env.e2e + Playwright Chromium (local browser cache)
npm run build          # shared → server → client
npm run test           # shared + client vitest suites
npm run lint           # eslint across all packages
npm run lint:fix       # eslint with autofix
npm run test:e2e       # Playwright combat UI tests (client :5174, API :3002)
npm run dev            # local stack (client :5173, server :3001)
npm run dev:cf         # Vite dev (:5173, HMR) + wrangler dev (:8787); open :5173
npm run deploy:cf      # production deploy
```

After changing `@gaem/shared`, rebuild (or run `dev`, which watches shared).

Do **not** commit, push, or open PRs unless the user explicitly asks.

## Secrets

Entering the game requires a password (GM or shared player password). Configure these in each runtime; never commit them.

| Variable | Purpose |
|----------|---------|
| `GM_PASSWORD` | Password for the GM role |
| `PLAYER_PASSWORD` | Shared password for all players |
| `AUTH_SECRET` | HMAC key used to sign/verify session tokens |
| `RANDOM_ORG_API_KEY` | Optional; dice via random.org |

- Local server: put them in a gitignored `.env` (loaded via `dotenv`).
- cf-worker: put them in a gitignored `.dev.vars` for local dev, and set with `wrangler secret put <NAME>` for production.

## Verification (required for all code changes)

Before considering any implementation task done, **run these commands and fix failures**:

```bash
npm run build
npm run test
npm run lint
npm run test:e2e
```

- **`npm run build`** — mandatory. Shared type errors block client and server; client imports `@gaem/shared` from `dist/`.
- **`npm run test`** — mandatory when tests exist for the code you touched. If you add or change shared game logic, add or update tests in `packages/shared` when the behavior is worth guarding (see Code style). Run the full root `npm run test` at minimum; re-run focused suites while iterating if helpful.
- **`npm run lint`** — mandatory. Runs ESLint, then client `vue-tsc` (`npm run typecheck`). Must report **0 errors** (ESLint warnings are pre-existing cleanup backlog; do not add new ones). The config (`eslint.config.mjs`, flat) is tuned to catch real defects, not formatting. Do not silence a rule to make a change pass — fix the code, or add a scoped `// eslint-disable-next-line <rule>` with a one-line justification only when the code is genuinely intentional. Type-aware ESLint rules on the backends and client `vue-tsc` both need `@gaem/shared` built first (`npm run build`), since they resolve types from `dist/`. A husky pre-commit hook runs `npm run lint` so IDE-only TS errors cannot slip into commits.
- **`npm run test:e2e`** — mandatory for code changes. Skip when the diff **only** adds or updates assets (e.g. JPGs/PNGs in the content package `assets/`, synced `public/` mirrors, portraits) with no logic, config, or UI behavior changes — including wire-up edits that only register a new tile set/label/glob so the assets appear in the gallery. Playwright headless browser tests for combat UI wiring (`packages/e2e`). **Always use the npm script** (never bare `npx playwright test` / `npx playwright install`). One-time setup: `npm run e2e:setup` (creates `.env.e2e` from `.env.e2e.example` if missing, installs Chromium into `packages/e2e/.playwright-browsers`). Re-run `e2e:setup` after Playwright version bumps or if browsers are missing. Cursor's agent sandbox pre-sets `PLAYWRIGHT_BROWSERS_PATH` to a wiped temp cache — our npm scripts and `playwright.config.ts` always override that to the in-repo directory.

  **Ports:** assume `npm run dev:cf` (or `npm run dev`) is already using the default ports (`:5173` client, `:8787` wrangler / `:3001` Express). E2e always binds **dedicated** ports so it can run in parallel:
  - client — `http://localhost:5174` (`E2E_CLIENT_URL`)
  - Express API — `http://localhost:3002` (`E2E_API_URL` / `PORT`)

  Do **not** point e2e at `:5173` / `:3001`. The root `test:e2e` script and `@gaem/e2e` defaults already set these; Playwright starts a fresh Express + Vite stack (`reuseExistingServer: false`) with `VITE_API_BASE` / `VITE_WS_URL` so the browser client talks to `:3002`. CI runs the same script after unit tests pass.

  **Alongside `dev:cf`:** port isolation alone used to be insufficient — e2e/`predev` wiped `public/tiles` and forced a shared `dist/` rebuild that raced `tsc --watch`, thrashing Vite HMR and WebSockets. Asset sync uses `packages/client/scripts/sync-dir.mjs` (rsync-like mirror, no full-tree wipe; portable for CF Workers Builds which lack `rsync`), e2e only rebuilds `@gaem/shared` when `dist/` is missing/stale (`packages/e2e/scripts/ensure-shared-built.mjs`), and the client auto-reconnects the game WebSocket after unexpected drops.

Do not skip verification because a change "looks small" or "only touches the client." Export omissions, missing shared rebuilds, and broken imports often surface only at build time. Asset-only imports (above) may skip `test:e2e`; still run `build` / `lint` if you touched TypeScript that registers those assets.

After fixing a build, test, lint, or e2e failure, re-run all four commands to confirm nothing else regressed.

### What the linter enforces (recurring blind spots)

These rules exist because these mistakes have been made before:

- **`@typescript-eslint/no-floating-promises` / `no-misused-promises`** (backends, type-aware) — an un-awaited KV or `broadcastConsole` write can be lost when a Durable Object hibernates. Always `await` persistence/logging, or mark deliberate fire-and-forget with `void`.
- **`vue/require-v-for-key` / `vue/valid-v-for`** — every `v-for` needs a key; use a **stable** id, never the loop index, for lists that can reorder (the linter can't detect index misuse, so this is on you in review).
- **`vue/no-side-effects-in-computed-properties`** — computeds must be pure; don't mutate refs inside them (memoization caches are the rare, explicitly-disabled exception).
- **`@typescript-eslint/no-unused-vars`** — dead imports/vars (warning). Prefix intentionally-unused with `_`.
- **Server ↔ cf-worker parity** is not lint-enforceable, so it is guarded by a test: `packages/shared/src/ws-parity.test.ts` reads both backends' WS dispatch source and fails if their inline message-type handlers diverge or if any `ClientMessage` type is left unhandled. When you add/rename a client message, update `types.ts`, the shared handler or both backends, and this test will confirm coverage. Shared game logic still belongs in `@gaem/shared` so a fix reaches both backends; keep `PatchBody`/validators complete on both sides.

**CI:** `.github/workflows/verify.yml` runs `ci-install.sh` (secret `CONTENT_GIT_TOKEN`) → `build → lint` (eslint + client `vue-tsc`) `→ test → e2e` on every PR and push to `main`. Primary Cloudflare deploy is Workers Builds (same install script + secret); optional manual deploy via `deploy-cloudflare.yml`. See `docs/content-package-private-cutover.md` and `docs/content-package-build-contract.md`.

## Architecture

- **WebSocket** `/ws` — clients receive `GameState`; server applies `validateMove` / `applyMove` / phase actions from shared package.
- **REST** — player profiles, character sheets, portraits, dice rolls. Auth via `X-Gaem-Role` and `X-Gaem-Player-Key` (see `useSession` / `useApi`).
- **Maps** — content package `maps/*.json` (installed under `node_modules/@gaem/hellpiercers-content/maps/`), synced to KV for cf-worker deploy.
- **Static game data** — JSON under content `src/data/`; registered via `@gaem/hellpiercers-content/register` at product boot. Engine reads catalogs through the ContentPack registry only.
- **Dev backend wiring** — the client reads `import.meta.env.DEV` and `VITE_CF_DEV` to pick a backend (`useApi.apiBase`, `useGameSocket.gameWsUrl`): plain `npm run dev` targets Express on `:3001`; `npm run dev:cf` sets `VITE_CF_DEV=1` so the client uses same-origin paths and Vite (`vite.config.ts` proxy) forwards `/api` + `/ws` to the wrangler Worker on `:8787`. In `dev:cf`, the client is served by Vite (HMR) — **not** rebuilt by wrangler: `scripts/cf-wrangler-build.sh` is a deliberate no-op under `WRANGLER_COMMAND=dev`, and `wrangler.toml` `watch_dir` excludes `client/src`. Don't reintroduce a full client `vite build` into the dev build path (it kills HMR). Open `http://localhost:5173` for both dev flows.

## Content / rules sources (while Hellpiercers remains in-tree)

When clarifying Hellpiercers mechanics or transcribing data into code, consult in order:

1. **`HELLPIERCERS v1.02.pdf`** (gitignored, repo root) — primary rulebook text.
2. **Content `rulebook/errata.md`** — official errata (local copy of [hellpiercers.com/#errata](https://hellpiercers.com/#errata)). Overrides or amends book text where they conflict.
3. **Content `rulebook/developer-clarifications.md`** — Sandy Pug developer answers from the itch.io forum. Use for edge cases not covered by the errata; does not duplicate errata entries.
4. **Content `rulebook/house-rules.md`** — table-specific house rules for this implementation. Overrides RAW and developer clarifications where they conflict.

Edit rulebook/data/assets in the content git checkout (`/Users/lindenholt/code/hellpiercers-content`), bump/tag, then bump the engine semver range if needed.

Don't guess stats or mechanics from memory — check these sources first.

These rulebook paths and the PDF move to the content package when extraction lands. Prefer engine-generic designs over new Hellpiercers hardcodes when touching shared combat/types.

## Rulebook PDF workflow

One-time setup (creates content `rulebook/.venv` with `pypdf`):

```bash
npm run rulebook:setup
```

The PDF must live at the repo root: `HELLPIERCERS v1.02.pdf`. It is gitignored; each developer keeps their own copy.

Extract text with:

```bash
# Page count
npm run rulebook -- --pages

# Single page (book page number, 1-indexed)
npm run rulebook -- --page 200

# Page range
npm run rulebook -- --from-page 196 --to-page 200

# Search all pages
npm run rulebook -- --search "Stain Flower"
npm run rulebook -- --search "fortification" --context 200
```

Many weapon/enemy **attack patterns are embedded images**, not extractable as text. Decode them with the same script (requires Pillow — re-run `npm run rulebook:setup` after pulling if image commands fail):

```bash
# List embedded images on a page (name, dimensions, filter type)
npm run rulebook -- --page 22 --list-images

# Extract pattern diagrams to PNG (default: content rulebook/out/page-N/, gitignored)
# By default skips full-page backgrounds; keeps images ≤600px wide/tall
npm run rulebook -- --page 22 --extract-images
npm run rulebook -- --from-page 21 --to-page 22 --extract-images

# Include full-page scan/background images
npm run rulebook -- --page 22 --extract-images --all-images

# Custom output directory
npm run rulebook -- --page 22 --extract-images --out /tmp/patterns
```

Open the PNGs to read tile layouts. Orange squares are attack tiles; green (when present) is the origin/player tile. Transcribe relative coordinates into `tiles` arrays in content `src/data/` (see sibling weapon entries for `anchorTile`, `healTiles`, `boundsTiles`).

**Do not** write raw `obj.get_data()` bytes to disk — FlateDecode images need decoding via Pillow (`RGB` for `width×height×3` bytes; JPEG `/DCTDecode` via `Image.open`). The script handles this.

**Agent workflow when transcribing rules:**

1. Check content `rulebook/errata.md`, `developer-clarifications.md`, and `house-rules.md` for overrides or edge cases.
2. Run `npm run rulebook:setup` if the content rulebook `.venv` is missing.
3. Search or pull the relevant page(s) from the PDF. For attack patterns, also run `--list-images` / `--extract-images` on those pages.
4. Add data in the content repo `src/data/`, commit/tag, refresh the engine install if the semver range requires it.
5. Match existing JSON field names and tag casing in sibling entries.

```bash
npm run rulebook -- --page 200
```

## Where to change things

| Task | Location |
|------|----------|
| Move validation, phases, HP, occupancy | `packages/shared/src/game.ts` |
| Map tiles, walkability, spawn | `packages/shared/src/map.ts` |
| Bundled tile appearance JPGs | content `assets/tiles/{setId}/` then `npm run sync-tile-assets -w @gaem/client` |
| Bundled tile feature PNGs | content `assets/tiles/features/{setId}/` then sync (same command) |
| Bundled tile overlay PNGs | content `assets/tiles/overlays/{setId}/` then sync (same command) |
| Enemy/class/weapon definitions | content `src/data/` + pack registration (edit content repo) |
| Board rendering, input | `packages/client/src/components/GameBoard.vue`, `BoardCell.vue` |
| UI panels | `packages/client/src/components/` |
| Cross-panel state | `packages/client/src/composables/` |
| Local API/WS handlers | `packages/server/src/index.ts` |
| Production API/WS | `packages/cf-worker/src/` (mirror server behavior) |
| Content-pack / registry work | See plans under `.cursor/plans/`; start with Track A |

When adding a client message or game action, update `types.ts`, shared validators/appliers, **and** both server implementations.

## Importing board tile appearances

GM paintbrush **appearances** are **JPG** under content `assets/tiles/{setId}/` (e.g. `basic/`, `paracletus/`). Do **not** commit appearance PNGs — JPG only. Content `bundledTileAppearances.ts` glob-discovers them; `public/tiles/` is a mirror (`sync-content-assets.mjs` via `predev` / `prebuild`).

**All imported appearance tiles must be exactly 32×32 JPG.** Upscale or downscale with nearest-neighbor (`Image.Resampling.NEAREST`) so pixel art stays crisp. Save with high JPEG quality and `subsampling=0` (e.g. Pillow `quality=95, subsampling=0`). JPG has no alpha — matte gutters/rounded corners to black (or leave sheet black) before save. Do not leave source sheets or other resolutions in the assets folders.

### Layout

| Path | Gallery | Paint behavior |
|------|---------|----------------|
| `tiles/{setId}/{name}.jpg` | One entry named `{name}` | Places that exact JPG |
| `tiles/{setId}/{groupId}/*.jpg` | One entry named `{groupId}` | Each paint picks a **random** member JPG |

Example: content `assets/tiles/paracletus/sand-light/1.jpg` … `16.jpg` → gallery shows **sand-light**; placed tiles store concrete keys like `tiles/paracletus/sand-light/7.jpg`.

Brush group keys are `tiles/{setId}/{groupId}` (no extension). They are never persisted on map tiles — only resolved member keys are.

### Splitting AI tileset sheets

ChatGPT / similar generators often produce a single square sheet (e.g. ~1254×1254) with an **N×N grid** of tiles on a **black background**, sometimes with gutters and rounded corners. Workflow:

1. Save the source sheet under `tmp/` (gitignored preferred) — do not commit the sheet.
2. Use Pillow from the content rulebook venv (`npm run rulebook:setup` if missing).
3. Detect content runs on non-black rows/cols (ignore noise runs shorter than ~40px). Expect equal-sized cells and consistent gutters.
4. Crop each cell; force near-black gutters/rounded-corner pixels (e.g. RGB channels below 18) to **black** (JPG has no transparency).
5. Resize each crop to **32×32** with nearest-neighbor.
6. Write **`.jpg`** into the content set folder (single) or a **group subfolder** (randomized): e.g. `assets/tiles/paracletus/sand-dark/1.jpg` … `16.jpg` (`quality=95, subsampling=0`).
7. Refresh the engine content install if needed, then `npm run sync-tile-assets -w @gaem/client` (or rely on the next `dev`/`build` `pre*` hook).

No code change is needed for new files in an existing set or group — the glob picks them up. Adding a **new set folder** also requires a label in `SET_LABELS` in `packages/client/src/lib/bundledTileAppearances.ts` and including that folder in the glob.

### Feature sets

Feature overlays (trenches, ruins, etc.) stay **PNG** (alpha) under content `assets/tiles/features/{setId}/` with the same single/group layout as appearances. Keys are `tiles/features/{setId}/...`. New feature sets need labels + glob updates in the content package. The paintbrush Viewer dropdown filters the feature gallery per set.

### Overlay sets

Tile overlays (stains, etc.) are **PNG** (alpha) under content `assets/tiles/overlays/{setId}/` with the same single/group layout. Keys are `tiles/overlays/{setId}/...`. On the board, layers stack **Color → Base → Overlay → Feature**.

## Client conventions

- Vue 3 `<script setup lang="ts">`, Composition API.
- Relative imports use `.js` extension (e.g. `from "./useGameState.js"`).
- Prefer existing composables (`useGameState`, `useSession`, `useApi`, `useBoardSelection`, …) over new global state.
- Reuse shared UI before adding one-off markup: `PanelShell`, `HpBar`, `NumberStepper`, `ModalDialog`, `PlayerItemDetail`, `BoardCell`.
- CSS design tokens and utilities live in `packages/client/src/style.css` (`var(--color-*)`, `.panel`, `.list-card`, `.stepper`, etc.). Avoid hardcoding `#30363d`-style palette in new scoped styles.
- `GameBoard` is performance-sensitive: precompute cell state, avoid per-cell scans in templates, use `BoardCell` + `v-memo`.
- **Tile tooltips** — show effect name (and stack count only when stacks matter). Never append `summary` or `description` text in board tile tooltips. Presence-only tile effects (e.g. Stained, Annihilation Corridor) use a display name with no stack value. Prefer `TILE_EFFECT_IMAGE_URLS` overlays for board markers when an icon asset exists.
- **Bundled tile appearances** — every appearance under content `assets/tiles/{setId}/` must be **32×32 JPG** (features under `features/` stay PNG; see Importing board tile appearances).

## Code style

- **Minimize scope** — smallest correct diff; don't refactor unrelated code.
- **Minimize comments** — only for non-obvious business logic; use `//` not block comments.
- **Minimize helpers** — inline one-off logic; extract only when genuinely reused (DRY).
- Match surrounding naming, types, and patterns; don't over-abstract.
- No tests unless requested or they cover real behavior worth guarding.

## GM vs player

Many panels branch on `useSession().isGm`. Players see reduced enemy/sheet detail. Don't leak GM-only stats (HP bars, attacks, spawn tools) to player UI unless intended.

## Common pitfalls

- **`tileAt` / occupancy** — use `buildBoardOccupancy` and cached tile index patterns; don't scan all enemies per cell.
- **Server parity** — a fix in `packages/server` often needs the same change in `packages/cf-worker/src/game-room.ts`.
- **Shared build** — client imports `@gaem/shared` from `dist/`; type errors in shared block the whole build.
- **Character sheets** — persisted in KV (prod) / memory (local); portraits in R2 (prod).
- **Content coupling** — avoid new name/class/weapon string branches in engine modules; extend `specialId` / handler registries instead (see content-pack plan Track B).

## Checklist before finishing

- [ ] `npm run build` passes (run it; do not assume)
- [ ] `npm run test` passes (run it; fix or add tests for changed behavior)
- [ ] `npm run lint` reports 0 errors and no new warnings
- [ ] `npm run test:e2e` passes (run it; do not assume) — skip for asset-only changes (see Verification)
- [ ] Shared game logic updated if behavior changed
- [ ] Server and cf-worker stay in sync for WS/REST changes
- [ ] No secrets committed (`.env`, `.dev.vars`)
- [ ] UI uses design tokens / shared components where applicable
- [ ] New work does not deepen Hellpiercers hardcodes in the engine when a registry/hook would do
