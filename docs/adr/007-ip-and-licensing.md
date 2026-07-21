# ADR 007: IP and licensing boundaries

## Status

Accepted (parent area #10)

## Context

Hellpiercers catalogs, art, maps, rulebook, and pack UI live in a private content package. The engine may eventually be open-sourced; content must stay proprietary. Cutover already removed in-tree content catalogs; remaining work is explicit licenses and clear boundaries.

## Decision

1. **Engine (`vtt-core`)** — MIT (`LICENSE`, `"license": "MIT"` on root and `@vtt-core/*` workspace packages).
2. **Content (`@vtt-core/hellpiercers-content`)** — proprietary / `"license": "UNLICENSED"`; all rights reserved; not licensed for redistribution.
3. **No per-file SPDX headers** — root LICENSE files + README notices are enough while repos stay private.
4. **Forbidden in engine source tree** — Hellpiercers catalog JSON under `packages/shared`, tracked HP art under engine packages (e.g. `packages/cf-worker/enemy-portraits`), rulebook PDF/tooling owned by content (engine keeps thin `scripts/rulebook*.mjs` wrappers only).
5. **Allowed product coupling** — `client` / `server` / `cf-worker` may depend on and boot-register `@vtt-core/hellpiercers-content`; client may import `./combat-ui` and `./tiles`; Highshade shell typography may remain in the client; interim combat module key names in shared remain until a later peel.
6. **Rulebook PDF** — lives at the **content** repo root (gitignored). Engine `npm run rulebook*` resolve the content package and invoke its tooling.

## Consequences

- Grep acceptance: [content-package-private-cutover.md](../content-package-private-cutover.md).
- Publishing or open-sourcing the engine must not include the content package or synced `public/tiles` / `public/enemies` mirrors.
- Content CI and engine CI stay separate (ADR 006).
