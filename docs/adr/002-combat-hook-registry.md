# ADR 002: Combat hook registry

## Status

Accepted (Track B)

## Context

Track A registered catalogs via `ContentPack`. Combat still used import-time Hellpiercers registrations (`registerCountdownHandler`, `registerAgnosiaHandler`) and `specialId ===` branches in attack resolve. The engine/content split needs those hooks on the same pack facade.

## Decision

1. **Optional `combat` on `ContentPack`** — `CombatHookContribution` may supply `specialIdHandlers`, `countdownHandlers`, and `agnosiaHandlers`. Applied inside `registerContentPack` after catalogs; `resetContentPackForTests` clears combat Maps.
2. **`specialId` is first-class validate/apply** — Engine dispatches `GmEnemyAction.attack` via `getSpecialIdHandler(spec.specialId)`. No new `===` branches for content abilities.
3. **Countdown and agnosia owned by the pack** — Existing Map registries remain; Hellpiercers (not module load) registers handlers. Gorgenaut interactive agnosia (`confirmGorgenautAgnosia`) stays a grandfathered hybrid until WS nesting lands.
4. **WS / protocol policy** — Prefer nesting content behavior under `playerAction` / `gmEnemyAction`. New top-level `ClientMessage` types require a follow-on (generic confirm-flow or pack message contribution). Not invented here.
5. **Combat modules on the pack** — Named implementations register via `CombatHookContribution.modules` (opaque string keys) applied inside `registerContentPack`. Shared engine call sites dispatch through `combatMod(key)` / `content-modules-api` (no IP-named facade files).

## Remaining migrations

| Item | Status |
|------|--------|
| **`orobas-stained-line`** | Done — content `specialId` handler |
| **`onHit: teleportToStain`** | Removed (dead type; unused in JSON) |
| **Provoke name gates** | Done — content `provoke-rules.ts`; shared still has interim string constant exports |
| **Kopis retaliation body** | Done — `onProvokeRetaliation` hook; body in content `kopis.ts` |
| **Gorgenaut agnosia block** | Done — content + `pendingConfirmHandlers` / `confirmPending` |
| **WS nesting** | Done — nested `armorAction` / `weaponActive` only; legacy `heavenBurningUnfold` / `towerTeleport` / `kataptyEndTurn` / `confirmGorgenautAgnosia` removed |
| **Facade retirement** | Done — IP-named shared facade files deleted; `ContentCombatKey` install bridge removed; modules on `CombatHookContribution` |

Also still content-owned: stainwalk kind maps, class/weapon/equipment plugins, client board-mode plugins.

## Consequences

- Product boot stays `@vtt-core/hellpiercers-content/register`; combat registers inside `registerHellpiercersContent()` (see ADR 005).
- Fixture packs without `combat` leave combat Maps empty after reset/register.
- Follow-on combat migrations register new handlers on the same contribution shape.
