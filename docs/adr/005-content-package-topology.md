# ADR 005: Content package topology and product wiring

## Status

Accepted (Track E)

## Context

Tracks A–D put catalogs, combat hooks, campaign config, and client contributions behind register-once APIs. Hellpiercers registration, JSON, named combat modules, assets, maps, and rulebook tooling still lived under engine packages (`@gaem/shared` / `@gaem/client`). Track E peels that IP into a content package and leaves the engine generic.

## Decision

1. **In-repo strangler package** — `@gaem/hellpiercers-content` (`packages/hellpiercers-content`) owns Hellpiercers registration, catalogs, named combat implementations, client contributions, assets, maps, and rulebook tooling. Private git / GitHub Packages cutover keeps the same package name and `./register` + `./register-client` exports.
2. **Product vs engine dependencies** — `@gaem/shared` must **not** list `@gaem/hellpiercers-content` in `package.json`. Product packages (`@gaem/client`, `@gaem/server`, `@gaem/cf-worker`) **may** depend on it for boot registration. “Engine packages” in earlier wording means shared (+ future pure shell), not product entries.
3. **Product boots import content** — Express, CF Worker/DO, and Vue `main.ts` side-effect-import `@gaem/hellpiercers-content/register` (and client `./register-client`).
4. **Dual exports** — `./register` applies shared `ContentPack` (catalogs + combat + campaign) only. `./register-client` may pull Vue and is never imported by Worker/Express.
5. **Combat implementations via pack modules** — Named HP combat modules live in the content package and register on `CombatHookContribution.modules`. Shared engine code dispatches via `combatMod(key)` / internal `content-modules-api` (not public barrel exports). Client UI helpers import `@gaem/hellpiercers-content/combat-ui`.
6. **Testing** — Shared Vitest setupFiles register `createFixtureContentPack()` with stub `combat.modules`. Hellpiercers suites live under `@gaem/hellpiercers-content`. Playwright e2e uses product boots.
7. **Assets / maps / rulebook** — Owned by the content package. Product `sync-dir` / `sync-maps` and root `rulebook*` scripts read content-package paths. `packages/client/public/` remains the Vite/CF runtime mirror.
8. **Client peel before private remote** — HP panels, theme CSS, and tile `import.meta.glob` modules must live in the content package (or be imported via package exports). Content must not use relative `../../../client/...` paths — those break when the package is no longer a sibling workspace folder.
9. **Wrangler** — Alias `@gaem/hellpiercers-content/register` to content `src/register.ts` (mirror shared source alias). Build compiles shared + content + client before deploy. Workers Builds private-dep auth is documented for the remote cutover; no alternate deploy platform.
10. **Non-goals** — Runtime-downloaded packs, hot-reload, multi-pack, renaming `@gaem/*` engine packages, sheet/pack-version KV migrations (parent #7). Nested `GameState.campaign` + campaign hooks are parent area #2 (see ADR 003 amendment), not a Track E non-goal.

## Consequences

- `@gaem/shared/register-hellpiercers` is removed; boots use `@gaem/hellpiercers-content/register`.
- Shared barrel does not export Hellpiercers registration helpers.
- Fixture-default engine tests must not assume Hellpiercers catalog names; HP suites move to the content package.
- Private cutover: see [content-package-private-cutover.md](../content-package-private-cutover.md). Replace the workspace folder with a git/npm dependency of the same name; configure `.npmrc` / deploy keys so Workers Builds can `npm install` the private package.
