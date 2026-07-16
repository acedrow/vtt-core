# ADR 001: Content-pack facade and catalog registry

## Status

Accepted (Track A)

## Context

Hellpiercers static data lives in `@gaem/shared` today. The engine/content split requires a stable registration API so catalogs can later move to a private content package without rewriting call sites.

## Decision

1. **Facade of sub-registries** — `ContentPack` is a thin facade. Track A implements catalogs (`registerContentPack({ id, version, catalogs })`). Track B adds optional `combat` hooks (see [ADR 002](002-combat-hook-registry.md)). Track C adds optional `campaign` config (see [ADR 003](003-campaign-extension-contract.md)). Client UI contributions use a separate client-only API (see [ADR 004](004-client-contribution-registry.md)).
2. **Sync register-once lifecycle** — Registration is synchronous and eager at process/isolate boot. Same `id` + `version` is idempotent (CF Worker HTTP + Durable Object dual entry). A different pack while one is loaded throws. `resetContentPackForTests()` exists only for Vitest.
3. **Getter stability** — Public getters and bulk array export names (`getEnemyListingByName`, `PLAYER_CLASSES`, …) remain stable during the strangler. Bulk arrays keep identity; loaders clear and refill them.
4. **Client vs server contribution split** — Server/Worker register catalogs (and later combat/campaign). Client registers the same catalogs at boot plus UI/assets later via a client-only entry so Workers never pull Vue.
5. **Pack identity** — `id` + `version` are recorded on the registered pack for debug. Persisting them on game/room state is deferred.
6. **Non-goals** — No runtime downloads, hot-reload packs, or multiple simultaneous packs.

## Consequences

- Product boots must side-effect-import `@gaem/hellpiercers-content/register` before other `@gaem/shared` usage (see [ADR 005](005-content-package-topology.md)).
- Engine `*-data.ts` modules must not import Hellpiercers JSON.
- Engine CI runs on the fixture pack only (Track E); Hellpiercers tests live in `@gaem/hellpiercers-content`.
- Combat hooks register with the same pack (Track B / ADR 002); catalog-only packs leave combat Maps empty. Named HP combat implementations live in the content package and install into shared facades at register time (ADR 005).
- Campaign config registers with the same pack (Track C / ADR 003). Nested `GameState.campaign` + `campaignHooks` are parent area #2 (see ADR 003 amendment).
- Client UI/assets register via `registerClientContentPack` (Track D / ADR 004) from `@gaem/hellpiercers-content/register-client`; Workers never import that entry.
