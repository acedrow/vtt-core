# ADR 004: Client contribution registry

## Status

Accepted (Track D)

## Context

Tracks A–C register catalogs, combat hooks, and campaign config on the shared `ContentPack` facade. Vue shell still hardcodes Hellpiercers themes, tile-set gallery labels, document title, Overworld/Base Upgrades chrome tabs, and SideNav enemy Data entries. Parent area #4 needs a first slice so the shell discovers those from a pack without putting Vue into the Worker bundle.

## Decision

1. **Client-only sibling API** — `registerClientContentPack` / `requireClientContentPack` / `resetClientContentPackForTests` live in `@vtt-core/client` (`client-content-pack.ts`). Shared `ContentPack` stays `{ catalogs, combat?, campaign? }` with no Vue types or components.
2. **Sync register-once** — Same lifecycle as Track A: same `id`+`version` is a no-op; a different pack while one is loaded throws; Vitest reset clears. No async load.
3. **Enemy Data nav from catalogs** — SideNav “Enemies — …” entries and RightPanel/FactionInfoPanel gates use shared `listEnemyFactionIds()` / `factionHasEnemyListings`, not the client contribution.
4. **Main chrome panels are pack contributions** — Engine always owns TACCOM. Pack registers ordered `mainSections` with Vue components (Overworld, Base Upgrades today). Optional section metadata: `pingChannel` (map-ping badge surface) and `opensResources` (select pack Resources data category on tab). AppShell iterates pack sections and reads that metadata instead of hardcoding section ids.
5. **SideNav pack sections** — Engine always owns Maps and Character Sheets. Pack registers ordered `sideNavSections` with `{ id, label, channel: "faction" | "table" }`; SideNav renders those expanders and wires existing selection composables. Fixture packs omit them.
6. **Pack data categories** — Beyond engine Data buttons (`armor`…`patterns`) and catalog-driven enemy factions, pack may register `dataCategories` (`{ id, label }`). Hellpiercers registers `resources` this way; `PartyResourcesPanel` stays engine-owned.
7. **Themes = metadata in pack; CSS stays in-repo** — Pack supplies theme options, `defaultThemeId`, and legacy id remaps. `themes.css` `[data-theme]` blocks stay until Track E; pack theme ids must match those attributes.
8. **Tile labels from pack; Vite globs stay** — Appearance/feature/overlay set labels live on the client contribution. `import.meta.glob` brace-lists remain in `bundledTile*.ts` until Track E co-locates globs + labels in the content package.
9. **Branding** — Pack supplies `documentTitle` and required `branding` (`landingPrefix`, `landingAccent`, `faviconHref`) set at client boot. `LandingView` shell stays in `@vtt-core/client` and renders pack branding; favicon URL is pack-owned (Vite asset import from content). Party resource display names come from shared campaign getters (`getPartyResourceLabel`), not the client contribution. Convoy info kicker uses the label of the `mainSections` entry with `pingChannel: "overworld"` (fallback `"Map"`). Highshade / shell typography and thin `bundledTile*` re-exports remain in the client.
10. **Boot** — Client imports `@vtt-core/hellpiercers-content/register`, then `@vtt-core/hellpiercers-content/register-client`, then applies title/favicon from the client pack, then `initTheme` / mount (see ADR 005).

## Consequences

- Workers and Express never import client contribution modules.
- Track E can move `hellpiercers-client-content`, themes CSS, tile globs, and panel SFCs into the private content package while the engine keeps the shell + `registerClientContentPack` API.
- Persisted UI (`dataCategory`, `activeMainTab`) must validate against catalog/pack lists, not a hardcoded enum of Hellpiercers ids.
