# ADR 008: Package and product rename to vtt-core

## Status

Accepted

## Context

The engine GitHub repo is `acedrow/vtt-core`, but npm packages, HTTP auth headers, Cloudflare worker/R2 resource names, and browser storage keys still used a legacy product slug. That mismatch is removed.

## Decision

1. **npm scope** — `@vtt-core/shared`, `@vtt-core/client`, `@vtt-core/server`, `@vtt-core/cf-worker`, `@vtt-core/e2e`, `@vtt-core/hellpiercers-content`. Root workspace `"name": "vtt-core"`.
2. **Auth** — `VttRole`; headers `X-Vtt-Role` / `X-Vtt-Player-Key` (hard cut; no dual-read of legacy headers).
3. **Client storage** — `vtt-core-session`, `vtt-core-ui*`, `vtt-core-theme*`, `vtt-core-settings*` (hard cut).
4. **Cloudflare** — Worker `name = "vtt-core"`; R2 buckets `vtt-core-portraits` / `vtt-core-portraits-preview`. KV/DO binding identifiers unchanged.
5. **Content** — package renamed at tag **`v0.0.8`**; engine depends on `#semver:^0.0.8`.
6. **Acceptance** — tracked source and docs contain no legacy product slug (verify with a case-insensitive search excluding `node_modules`).

### Ops checklist (Cloudflare)

1. Create R2 buckets `vtt-core-portraits` and `vtt-core-portraits-preview`; copy objects from the previous portrait buckets.
2. Deploy worker `vtt-core` (new worker name); re-apply secrets; update Workers Builds active worker / routes/DNS.
3. Retire the previous worker after cutover.
4. Ensure `CONTENT_GIT_TOKEN` still works with the renamed content package installs.

## Consequences

- Clients must re-authenticate (new headers / session key).
- Content `v0.0.8` must be tagged before engine CI can `npm ci` the git dep.
- Docs and ADRs use `@vtt-core/*` exclusively.
