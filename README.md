# vtt-core

Browser-based tactical grid VTT engine (GM/player roles, character sheets, real-time board sync).

Hellpiercers IP is a private git dependency (`@vtt-core/hellpiercers-content`). See `AGENTS.md`, `docs/content-package-private-cutover.md`, and `.cursor/plans/` for agent guidance.

## IP / licensing

| Tree | License |
|------|---------|
| This engine repo (`vtt-core`, `@vtt-core/shared`, product shells) | [MIT](LICENSE) |
| `@vtt-core/hellpiercers-content` (catalogs, art, maps, rulebook, HP UI) | Proprietary — private; not licensed for redistribution |

Product packages (`client` / `server` / `cf-worker`) may depend on and register the content pack at boot. `@vtt-core/shared` must not import or ship Hellpiercers catalogs, art, or rulebook. See [ADR 007](docs/adr/007-ip-and-licensing.md).

## Packages

| Package | Role |
|---------|------|
| `@vtt-core/shared` | Types, map/game logic, combat framework, content-pack registries |
| `@vtt-core/hellpiercers-content` | Private git dep — catalogs, combat modules, assets, maps, HP UI |
| `@vtt-core/client` | Vue 3 SPA — game board, character sheets, session flow |
| `@vtt-core/server` | Local dev backend — Express REST API + WebSocket game room |
| `@vtt-core/cf-worker` | Production backend — Cloudflare Worker serving the built client and APIs |

npm package names remain `@vtt-core/*` for now.

## Architecture

```
┌─────────────┐     REST + WebSocket      ┌──────────────────────────────┐
│   client    │ ◄────────────────────────►│  server (local)              │
│  (Vue/Vite) │                           │  in-memory state             │
└─────────────┘                           └──────────────────────────────┘
       │                                  ┌──────────────────────────────┐
       └─────────────────────────────────►│  cf-worker (production)      │
                                          │  Worker → static assets      │
                                          │  Durable Object → game room  │
                                          │  KV → profiles & maps        │
                                          │  R2 → character portraits    │
                                          └──────────────────────────────┘
                          both use @vtt-core/shared for game rules & types
```

**Game sync** — Clients connect over WebSocket at `/ws`. The server broadcasts `GameState` (map tiles, player positions) after joins and moves. Shared validation (`validateMove`, `applyMove`, etc.) lives in `@vtt-core/shared`.

**APIs** — Player profiles (`/api/player-profiles`) and character sheets (`/api/character-sheets`, with portrait upload) are role-gated via `X-Vtt-Role` and `X-Vtt-Player-Key` headers.

**Maps** — JSON map definitions live in the content package `maps/` (installed under `node_modules/@vtt-core/hellpiercers-content/maps/`). The cf-worker syncs them to KV before deploy. Product boots register via `@vtt-core/hellpiercers-content/register` (see `docs/adr/005-content-package-topology.md`).

## Development

Requires Node 22 (`nvm use`).

```bash
npm install          # needs read access to private acedrow/hellpiercers-content
npm run dev          # shared/content watch + local server (3001) + client (Vite :5173)
npm run dev:cf       # shared/content watch + Vite dev (:5173, HMR) + wrangler dev (:8787)
npm run deploy:cf    # build and deploy to Cloudflare
```

CI uses `bash scripts/ci-install.sh` with secret `CONTENT_GIT_TOKEN` (also set as a Workers Builds build secret; install command `bash scripts/ci-install.sh`). Before pushing, run the same checks CI does (`.github/workflows/verify.yml`):

```bash
npm run e2e:setup      # once per machine / after Playwright upgrades
npm run build
npm run lint
npm run test
npm run test:e2e       # Playwright on :5174 / :3002 (safe alongside `dev:cf` on :5173 / :8787)
```

E2E browsers are stored in `packages/e2e/.playwright-browsers` (gitignored) so they persist across runs. The e2e stack uses **dedicated ports** (`5174` client, `3002` API) so it can run while `npm run dev:cf` or `npm run dev` is already up on the default ports.

Open the app at `http://localhost:5173` (the Vite dev server) in both dev flows:

- `npm run dev` — the client talks directly to the local Express server on `http://localhost:3001`.
- `npm run dev:cf` — the client uses same-origin paths; Vite proxies `/api` and `/ws` to the wrangler Worker on `:8787`, matching production. Client edits hot-reload via Vite HMR; worker/shared edits reload via wrangler.

In production, the Worker serves the SPA and handles all API/WS routes on the same origin.
