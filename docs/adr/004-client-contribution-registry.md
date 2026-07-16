# ADR 004: Client contribution registry

## Status

Accepted (Track D)

## Context

Tracks A–C register catalogs, combat hooks, and campaign config on the shared `ContentPack` facade. Vue shell still hardcodes Hellpiercers themes, tile-set gallery labels, document title, Overworld/Base Upgrades chrome tabs, and SideNav enemy Data entries. Parent area #4 needs a first slice so the shell discovers those from a pack without putting Vue into the Worker bundle.

## Decision

1. **Client-only sibling API** — `registerClientContentPack` / `requireClientContentPack` / `resetClientContentPackForTests` live in `@gaem/client` (`client-content-pack.ts`). Shared `ContentPack` stays `{ catalogs, combat?, campaign? }` with no Vue types or components.
2. **Sync register-once** — Same lifecycle as Track A: same `id`+`version` is a no-op; a different pack while one is loaded throws; Vitest reset clears. No async load.
3. **Enemy Data nav from catalogs** — SideNav “Enemies — …” entries and RightPanel/FactionInfoPanel gates use shared `listEnemyFactionIds()` / `factionHasEnemyListings`, not the client contribution.
4. **Main chrome panels are pack contributions** — Engine always owns TACCOM. Pack registers ordered `mainSections` with Vue components (Overworld, Base Upgrades today). AppShell iterates pack sections.
5. **Themes = metadata in pack; CSS stays in-repo** — Pack supplies theme options, `defaultThemeId`, and legacy id remaps. `themes.css` `[data-theme]` blocks stay until Track E; pack theme ids must match those attributes.
6. **Tile labels from pack; Vite globs stay** — Appearance/feature/overlay set labels live on the client contribution. `import.meta.glob` brace-lists remain in `bundledTile*.ts` until Track E co-locates globs + labels in the content package.
7. **Branding** — Pack supplies `documentTitle` and required `branding` (`landingPrefix`, `landingAccent`, `faviconHref`) set at client boot. `LandingView` shell stays in `@gaem/client` and renders pack branding; favicon URL is pack-owned (Vite asset import from content). Party resource display names come from shared campaign getters (`getPartyResourceLabel`), not the client contribution. Highshade / shell typography and thin `bundledTile*` re-exports remain in the client.
8. **Boot** — Client imports `@gaem/hellpiercers-content/register`, then `@gaem/hellpiercers-content/register-client`, then applies title/favicon from the client pack, then `initTheme` / mount (see ADR 005).

## Consequences

- Workers and Express never import client contribution modules.
- Track E can move `hellpiercers-client-content`, themes CSS, tile globs, and panel SFCs into the private content package while the engine keeps the shell + `registerClientContentPack` API.
- Persisted UI (`dataCategory`, `activeMainTab`) must validate against catalog/pack lists, not a hardcoded enum of Hellpiercers ids.
