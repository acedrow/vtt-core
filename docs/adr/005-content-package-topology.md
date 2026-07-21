# ADR 005: Content package topology and product wiring

## Status

Accepted (Track E)

## Context

Tracks A–D put catalogs, combat hooks, campaign config, and client contributions behind register-once APIs. Hellpiercers registration, JSON, named combat modules, assets, maps, and rulebook tooling still lived under engine packages (`@vtt-core/shared` / `@vtt-core/client`). Track E peels that IP into a content package and leaves the engine generic.

## Decision

1. **Content package** — `@vtt-core/hellpiercers-content` (private git dep; formerly in-repo strangler at `packages/hellpiercers-content`) owns Hellpiercers registration, catalogs, named combat implementations, client contributions, assets, maps, and rulebook tooling. Same package name and `./register` + `./register-client` exports.
2. **Product vs engine dependencies** — `@vtt-core/shared` must **not** list `@vtt-core/hellpiercers-content` in `package.json`. Product packages (`@vtt-core/client`, `@vtt-core/server`, `@vtt-core/cf-worker`) **may** depend on it for boot registration. “Engine packages” in earlier wording means shared (+ future pure shell), not product entries.
3. **Product boots import content** — Express, CF Worker/DO, and Vue `main.ts` side-effect-import `@vtt-core/hellpiercers-content/register` (and client `./register-client`).
4. **Dual exports** — `./register` applies shared `ContentPack` (catalogs + combat + campaign) only. `./register-client` may pull Vue and is never imported by Worker/Express.
5. **Combat implementations via pack modules** — Named HP combat modules live in the content package and register on `CombatHookContribution.modules`. Shared engine code dispatches via `combatMod(key)` / internal `content-modules-api` (not public barrel exports). Client UI helpers import `@vtt-core/hellpiercers-content/combat-ui`.
6. **Testing** — Shared Vitest setupFiles register `createFixtureContentPack()` with stub `combat.modules`. Hellpiercers suites live under `@vtt-core/hellpiercers-content`. Playwright e2e uses product boots. Full matrix: [ADR 006](006-testing-strategy.md).
7. **Assets / maps / rulebook** — Owned by the content package. Product `sync-dir` / `sync-maps` and root `rulebook*` scripts read content-package paths. `packages/client/public/` remains the Vite/CF runtime mirror.
8. **Client peel before private remote** — HP panels, theme CSS, and tile `import.meta.glob` modules must live in the content package (or be imported via package exports). Content must not use relative `../../../client/...` paths — those break when the package is no longer a sibling workspace folder.
9. **Wrangler** — Alias `@vtt-core/hellpiercers-content/register` to content **source** under `node_modules` (Workers Builds caches may lack `dist/`). Build compiles shared + content + client before deploy. Workers Builds private-dep auth is documented for the remote cutover; no alternate deploy platform.
10. **Non-goals** — Runtime-downloaded packs, hot-reload, multi-pack, renaming `@vtt-core/*` engine packages. Nested `GameState.campaign` + campaign hooks are parent area #2 (see ADR 003 amendment). Sheet/pack-version KV stamps and migrators are parent area #7 (engine done; content `sheetDataKeys` in ≥0.0.6).

## Consequences

- `@vtt-core/shared/register-hellpiercers` is removed; boots use `@vtt-core/hellpiercers-content/register`.
- Shared barrel does not export Hellpiercers registration helpers.
- Fixture-default engine tests must not assume Hellpiercers catalog names; HP suites move to the content package.
- Private cutover: see [content-package-private-cutover.md](../content-package-private-cutover.md). Replace the workspace folder with a git/npm dependency of the same name; configure `.npmrc` / deploy keys so Workers Builds can `npm install` the private package.

## Amendment (2026-07-16) — Area #5 topology hardening

Locks private-cutover packaging decisions and in-repo path resolution:

1. **Private git + semver tags** — end-state dependency is `git+https://…#semver:^x.y.z` (SSH after host-key setup). Not GitHub Packages, not a git submodule. Optional `file:` sibling for local dry-run.
2. **Product stays in the engine repo** — no third thin product repo.
3. **Package-root resolution** — product tooling resolves content via `node_modules` / `scripts/content-package-root.mjs` (`./package.json` export).
4. **Wrangler** — aliases `@vtt-core/hellpiercers-content/register` to `../../node_modules/@vtt-core/hellpiercers-content/src/register.ts`.
5. **Publish hygiene** — content `"files"` allowlist ships `dist/`, `src/`, `assets/`, `maps/`, and rulebook tooling; excludes `rulebook/out` and `.venv`.

## Amendment (2026-07-17) — Phase C private cutover

1. **Installed** — product deps use `git+https://github.com/acedrow/hellpiercers-content.git#semver:^0.0.8`; workspace `packages/hellpiercers-content` deleted.
2. **No npm peerDependencies on content** — npm arborist cannot resolve private `@vtt-core/*` workspace peers during git prep; expected engine packages documented in the content README instead.
3. **Build** — `npm run build:content` / `dev:content` compile the installed package with the engine's TypeScript.
4. **Vite** — `optimizeDeps.exclude` for content exports so `register-client` shares the app's `@vtt-core/client/content-pack` module instance.
5. **CI auth** — `scripts/ci-install.sh` + secret `CONTENT_GIT_TOKEN` (GitHub Actions + Workers Builds install command). Set the secret once in each dashboard.

## Amendment (2026-07-17) — Phase 6B build / sync contract

1. **Contract doc** — [content-package-build-contract.md](../content-package-build-contract.md) locks what a content tag ships vs what the engine builds/syncs.
2. **Maps on deploy** — `scripts/cf-wrangler-build.sh` runs `sync-maps` on every non-dev wrangler build so bare `wrangler deploy` / Workers Builds cannot skip KV upload.
3. **Register asymmetry** — package `./register` → `dist/`; wrangler/Vite keep **source** aliases under `node_modules`.
