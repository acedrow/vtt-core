# Content package build / sync contract

**Status:** Accepted (Phase 6B, 2026-07-17)

Companion to [ADR 005](adr/005-content-package-topology.md) and [private cutover](content-package-private-cutover.md).

## What a content tag must ship

Content repo `package.json` `"files"` allowlist must include:

| Path | Role |
|------|------|
| `src/` | TS, Vue contributions, JSON under `src/data/`, tile `import.meta.glob` sources |
| `dist/` | Optional in the tag; engine always rebuilds via `npm run build:content` |
| `assets/` | Enemy PNGs + tile JPG/PNG at package root (not copied into `dist/`) |
| `maps/` | Map JSON at package root (not copied into `dist/`) |
| rulebook tooling | MD + scripts (exclude `rulebook/out`, `.venv`) |

There is **no** separate JSON catalog bundle export. Catalogs load through `@gaem/hellpiercers-content/register` (compiled from `src/data/`).

## What the engine must run

| Step | When | Script / hook |
|------|------|----------------|
| Resolve package root | Any sync/tooling | `scripts/content-package-root.mjs` → `require.resolve("@gaem/hellpiercers-content/package.json")` |
| Compile content | Before server/client/worker product use | `npm run build:content` |
| Mirror static assets | Before Vite dev/build | client `predev` / `prebuild` → `sync-content-assets` → `packages/client/public/{enemies,tiles}/` |
| Seed maps (Express) | Local `npm run dev` boot | `mapsDirPath()` reads installed `maps/` |
| Sync maps (CF) | Every non-dev wrangler build/deploy | `scripts/cf-wrangler-build.sh` → `npm run sync-maps -w @gaem/cf-worker` → remote `MAP_KV` |
| Sync maps (CF local) | `npm run dev:cf` | `sync-maps:local` → preview KV |

## Register export asymmetry (intentional)

| Consumer | Resolution |
|----------|------------|
| Node / package export `./register` | `dist/register.js` (after `build:content`) |
| Wrangler `[alias]` | `node_modules/.../src/register.ts` (Workers Builds caches may omit `dist/`) |
| Vite / client tsconfig | Source under `node_modules/.../src/` for `register`, `register-client`, `tiles`, `combat-ui` |

Do not “fix” this by pointing wrangler at `dist/` only — keep the source alias.

## Deploy checklist

1. Tag content (`vX.Y.Z`) and push tags on `acedrow/hellpiercers-content`
2. Bump engine product deps if the semver range needs it (`#semver:^…`)
3. `npm install` (with private-git auth in CI — see cutover doc)
4. `npm run build` (or Workers Builds / `wrangler deploy` `[build]`)
5. Maps: ensured by `[build]` → `sync-maps` (do not rely on a separate manual step for cloud)
6. Confirm wrangler secrets: `GM_PASSWORD`, `PLAYER_PASSWORD`, `AUTH_SECRET`, optional `RANDOM_ORG_API_KEY`

## Non-goals

- Runtime-downloaded packs from KV/R2
- Shipping assets inside content `dist/`
- ~~Sheet / pack-version KV migrations (parent #7)~~ engine stamps/migrators landed; content `sheetDataKeys` requires `@gaem/hellpiercers-content` ≥0.0.6
