# vtt-core

Browser-based tactical grid VTT engine (GM/player roles, character sheets, real-time board sync).

Hellpiercers IP is a private git dependency (`@gaem/hellpiercers-content`). See `AGENTS.md`, `docs/content-package-private-cutover.md`, and `.cursor/plans/` for agent guidance.

## Packages

| Package | Role |
|---------|------|
| `@gaem/shared` | Types, map/game logic, combat framework, content-pack registries |
| `@gaem/hellpiercers-content` | Private git dep — catalogs, combat modules, assets, maps, HP UI |
| `@gaem/client` | Vue 3 SPA — game board, character sheets, session flow |
| `@gaem/server` | Local dev backend — Express REST API + WebSocket game room |
| `@gaem/cf-worker` | Production backend — Cloudflare Worker serving the built client and APIs |

npm package names remain `@gaem/*` for now.

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
                          both use @gaem/shared for game rules & types
```

**Game sync** — Clients connect over WebSocket at `/ws`. The server broadcasts `GameState` (map tiles, player positions) after joins and moves. Shared validation (`validateMove`, `applyMove`, etc.) lives in `@gaem/shared`.

**APIs** — Player profiles (`/api/player-profiles`) and character sheets (`/api/character-sheets`, with portrait upload) are role-gated via `X-Gaem-Role` and `X-Gaem-Player-Key` headers.

**Maps** — JSON map definitions live in the content package `maps/` (installed under `node_modules/@gaem/hellpiercers-content/maps/`). The cf-worker syncs them to KV before deploy. Product boots register via `@gaem/hellpiercers-content/register` (see `docs/adr/005-content-package-topology.md`).

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
