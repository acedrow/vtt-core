# ADR 003: Campaign extension contract

## Status

Accepted (Track C); amended by parent area #2 (GameState nesting + campaign hooks)

## Context

Track A registered campaign *catalogs* (factions, base upgrades, convoys, GM stratcom, recon, game terms). Track C opened keyed maps and registered pack-owned campaign *config* while leaving runtime fields flat on `GameState`. Parent area #2 nests campaign runtime and peels apply modules behind hooks so `@gaem/shared` no longer owns Hellpiercers campaign semantics.

## Decision

1. **Optional `campaign` on `ContentPack`** — `CampaignContribution` supplies region→faction map, party resource keys/labels/defaults, starter unlocks, upgrade→feature maps, overworld geometry, and optional class loadout rules. Applied in `registerContentPack` after catalogs (and combat); `resetContentPackForTests` clears campaign config.
2. **Config, not catalogs** — Faction/base-upgrade/recon JSON stay on `CatalogContribution`. `CampaignContribution` is only non-catalog campaign config.
3. **Nested `GameState.campaign`** — Runtime fields (`partyResources`, `factionStates`, `overworld*`, `gmIchor`, `constructedBaseUpgrades`) live under typed `CampaignRuntimeState` on `GameState.campaign`. `normalizeGameState` lifts legacy top-level keys once, then stops emitting them. Call sites use shared campaign-state accessors only.
4. **Open keyed maps** — `FactionId`, region/convoy/recon ids, party resource keys, and campaign features are `string`. `FactionStates` is `Record<string, FactionState>`. Ensure/default helpers iterate catalog ids + contribution keys.
5. **`CharacterSheet.data` / `Player.data` bags** — Pack-owned sheet and live-player extras go under `data`. Content-specific loadout fields (including former top-level `yadathanTower`) must not be first-class engine keys. Packs declare REST top-level aliases via `campaignHooks.sheetDataKeys`.
6. **Optional `campaignHooks` on `ContentPack`** — `CampaignHookContribution` registers ensure/validate/apply for campaign WS actions plus optional sheet loadout extras, `sheetDataKeys`, and `ensureSheet` migrators. Hellpiercers implementations live in `@gaem/hellpiercers-content`; shared dispatches via [`campaign-hooks.ts`](../../packages/shared/src/campaign-hooks.ts) (no IP-named campaign facade modules).
7. **Pack stamps + migrators (parent area #7)** — `GameState` / `CharacterSheet` carry optional `contentPack: { id, version }`. Same pack id with a newer boot version runs `ensureSheet` (and room normalize stamps); different pack id rejects load/write. Missing stamp is legacy and is stamped on next successful ensure/write. Combat protocol union shrink remains parent area #3.

## Consequences

- Hellpiercers supplies `campaign` + `campaignHooks` inside `registerHellpiercersContent()`.
- Fixture packs supply minimal `campaign` config and ensure hooks so engine Vitest stays pack-driven.
- Client/content panels read `state.campaign` (via accessors), not flat `GameState` fields.
- Parent area #2 implementation: [shared_types_untangle_0a64d3ba](/Users/lindenholt/.cursor/plans/shared_types_untangle_0a64d3ba.plan.md) (supersedes 5104aaf5).
