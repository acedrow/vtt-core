# ADR 006: Testing strategy across two repos

## Status

Accepted (parent area #8)

## Context

Hellpiercers IP lives in the private content package; the engine must stay testable without that IP. Product e2e still boots the real pack. After private cutover, content Vitest needs a way to resolve `@vtt-core/shared` without declaring npm peers (ADR 005 / arborist).

## Decision

| Layer | Where | Pack / deps |
|-------|-------|-------------|
| Engine unit | `vtt-core` shared/client Vitest | Fixture mini-pack (`createFixtureContentPack` + stub `combat.modules`); no Hellpiercers catalogs |
| Content unit | `hellpiercers-content` Vitest | Registers Hellpiercers; links a built `@vtt-core/shared` from a checked-out engine ref |
| Product e2e | `vtt-core` Playwright | Product boots (`@vtt-core/hellpiercers-content/register`); no fixture-only e2e rewrite |
| Backend parity | `packages/shared` `ws-parity.test.ts` | Engine-only; both Express and CF Worker handlers |

### Content → shared link

- Local / CI: `npm run link:shared` (`scripts/link-engine-shared.mjs`) resolves `VTT_CORE_PATH` or sibling `../vtt-core`, installs and builds `packages/shared` only, symlinks `node_modules/@vtt-core/shared`.
- Content CI checks out `acedrow/vtt-core` into `.engine` (ref `ENGINE_REF`, default `main`) with secret `ENGINE_GIT_TOKEN`, then runs that link script. It does **not** run full engine `npm ci` (would require `CONTENT_GIT_TOKEN` and circular private-git install).
- Still no npm `peerDependencies` on content for `@vtt-core/*` (ADR 005).

### Engine CI

Unchanged: `scripts/ci-install.sh` + `CONTENT_GIT_TOKEN` → fixture unit tests → product e2e.

## Consequences

- HP behavioral suites stay out of engine `npm test`.
- Content contributors need a vtt-core checkout (or CI) for `link:shared`.
- Pin content CI to a non-`main` engine ref via workflow `ENGINE_REF` when validating against a release branch.
- Vue panels in content remain covered by product e2e, not content Vitest.

## Non-goals

- Fixture-only Playwright suite
- Publishing `@vtt-core/shared` to npm
- Running content Vitest inside engine CI
