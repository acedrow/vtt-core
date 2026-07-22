# ADR 009: Opaque combat protocol

## Status

Accepted (Opaque Peel Program P0)

## Context

Hellpiercers-named discriminants and fields still live on engine wire types in [`packages/shared/src/combat/types.ts`](../../packages/shared/src/combat/types.ts) and [`packages/shared/src/types.ts`](../../packages/shared/src/types.ts): `assistedLaunch`, `armorAction` kinds (`tower_teleport`, `katapty_end_turn`, …), `classActive` / `harpe*`, `classPassive` (`baseline_communism`), `weaponActive.omnistrike` / `.warhook`, `GmEnemyAction.swarmChip`, `ClientMessage.triggerReversal` / `declineReversal`, plus `AttackPreviewState` `omnistrike*` and `CombatState.swarmChipResolvedIds`.

ADR 002 nested pack behavior under named `armorAction` / `weaponActive` as an interim. That nesting removed legacy top-level messages but left proprietary vocabulary in the engine protocol union. Campaign `contentPack` stamps (ADR 003) already give rooms a versioned pack identity without a separate WS protocol version field.

This ADR freezes the opaque envelope contract and the old→new mapping. Runtime dual-read, client send, and handler rewrites are Opaque Peel Program phases P1–P4 — not this document.

## Decision

### 1. Target envelopes

```ts
// PlayerAction
| { action: "pack"; kind: string; detail?: Record<string, unknown> }

// GmEnemyAction
| { action: "pack"; kind: string; enemyId: string; detail?: Record<string, unknown> }

// ClientMessage (pack-owned top-level WS)
| { type: "packCombat"; kind: string; detail?: Record<string, unknown> }
```

`kind` strings are **content-owned vocabulary**. The engine validates envelope presence/shape only and dispatches via registries / `combatMod`, not IP-named TypeScript discriminants.

### 2. Engine-owned vs pack-owned

**Engine-owned** (remain first-class discriminants):

| Surface | Keep |
|---------|------|
| `PlayerAction` | `attack`, `shove`, `sprint`, `sprintMove`, `sprintCancel`, `weaponSwap`, `selectWeaponVariant`, `rez`, `commitHaste`, `resolveClassReaction`, `useEquipment`, `interact` |
| `GmEnemyAction` | `move`, `attack`, `assisted`, `exhaust` |
| `ClientMessage` | Existing engine types (`join`, `move*`, `playerAction`, `gmEnemyAction`, GM tools, campaign messages, …) **except** `triggerReversal` / `declineReversal` |

`useEquipment`, `interact`, and `resolveClassReaction` stay engine-owned: they are already stringy / `detail`-driven framework actions, not HP-named discriminants. Opaque peel targets named pack variants, not those envelopes.

**Pack-owned** (collapse into the envelopes above): see frozen migration table.

### 3. Dual-read window (keyed off `contentPack` + room normalize)

- Ingress **dual-accepts** old wire shapes and new envelopes for one content major (or until rooms stamp past a documented cutoff).
- Shared adds `normalizePlayerAction` / `normalizeGmEnemyAction` / `normalizeClientMessage` **before** dispatch (P1/P2). Room load continues through `normalizeGameState` and `GameState.contentPack` stamps ([`sheet-persistence.ts`](../../packages/shared/src/sheet-persistence.ts), [`game.ts`](../../packages/shared/src/game.ts)).
- Once P1/P2 land, the **client sends only new** envelopes.
- **No** separate WS protocol version field on messages — reuse `GameState.contentPack: { id, version }` and room normalize (same pattern as ADR 003 sheet stamps).
- After the dual-read window, drop old parsers in a later phase.

### 4. CombatState / AttackPreview bags (**P4 done**)

| Legacy (dual-read on migrate) | Current |
|-------------------------------|---------|
| `AttackPreviewState.omnistrikeStep` | `attackPreview.pack.omnistrikeStep` |
| `AttackPreviewState.omnistrikeBombIndices` | `attackPreview.pack.omnistrikeBombIndices` |
| `AttackPreviewState.omnistrikeAnchors` | `attackPreview.pack.omnistrikeAnchors` |
| `CombatState.swarmChipResolvedIds` | `combat.pack.swarmChipResolvedIds` |
| Deprecated `kopisMarks` / `chrysaorBrands` | Lift → `marks` / `brands` via `migrateCombatStateFields`; legacy keys deleted after lift |

`AttackPreviewState.pack?: Record<string, unknown>` and `CombatState.pack` hold pack-owned extras. `normalizeGameState` / `applySetAttackPreview` run migrators so persisted rooms and in-flight legacy preview WS still lift.

### 5. Frozen migration table (old → new)

Source of truth for “today” fields: [`packages/shared/src/combat/types.ts`](../../packages/shared/src/combat/types.ts) and reversal messages in [`packages/shared/src/types.ts`](../../packages/shared/src/types.ts). Detail schemas below are verbatim field lists from those types.

#### PlayerAction → `pack`

| Today | Opaque |
|-------|--------|
| `{ action: "assistedLaunch"; anchorX; anchorY }` | `{ action: "pack"; kind: "assistedLaunch"; detail: { anchorX: number; anchorY: number } }` |
| `{ action: "armorAction"; kind?; targetEnemyId?; targetPlayerId?; landingX?; landingY?; push?; x?; y?; keraunoTargetEnemyId?; targetEnemyIds? }` | `{ action: "pack"; kind: "armorAction"; detail: { kind?: "tower_teleport" \| "katapty_end_turn" \| string; targetEnemyId?: string; targetPlayerId?: string; landingX?: number; landingY?: number; push?: 1 \| 2 \| 3; x?: number; y?: number; keraunoTargetEnemyId?: string; targetEnemyIds?: string[] } }` |
| `{ action: "classActive"; kind?; harpeRecall?; harpeEquipWeapon?; targetEnemyIds?; targetPlayerIds?; x?; y?; allyPlayerId?; direction?; anchorX?; anchorY?; followUpMaxDamage?; gearSlot?; gearName? }` | `{ action: "pack"; kind: "classActive"; detail: { kind?: string; harpeRecall?: boolean; harpeEquipWeapon?: string; targetEnemyIds?: string[]; targetPlayerIds?: string[]; x?: number; y?: number; allyPlayerId?: string; direction?: PatternDirection; anchorX?: number; anchorY?: number; followUpMaxDamage?: boolean; gearSlot?: "weapon" \| "armor"; gearName?: string } }` |
| `{ action: "classPassive"; kind: "baseline_communism"; targetPlayerId }` | `{ action: "pack"; kind: "classPassive"; detail: { kind: "baseline_communism"; targetPlayerId: string } }` |
| `{ action: "weaponActive"; detail?; targetEnemyIds?; targetPlayerIds?; direction?; omnistrike?; warhook? }` | `{ action: "pack"; kind: "weaponActive"; detail: { detail?: string; targetEnemyIds?: string[]; targetPlayerIds?: string[]; direction?: PatternDirection; omnistrike?: { bombIndices: [number, number]; anchors: [{ x: number; y: number }, { x: number; y: number }]; direction: PatternDirection }; warhook?: { targetEnemyId?: string; targetX: number; targetY: number; landingX: number; landingY: number; damageRoll?: number; useBreaker?: boolean } } }` |

Notes on `armorAction`: `kind` values include `tower_teleport`, `katapty_end_turn`, and open `string`. Structured armor (`teleport_adjacent`, `push_recoil`, `place_tower`, `assisted` on the armor def) continues to select behavior via catalog + the same detail coords/ids — only the wire discriminant moves under `pack` / `armorAction`.

#### GmEnemyAction → `pack`

| Today | Opaque |
|-------|--------|
| `{ action: "swarmChip"; enemyId; targetPlayerIds }` | `{ action: "pack"; kind: "swarmChip"; enemyId: string; detail: { targetPlayerIds: string[] } }` |

#### ClientMessage → `packCombat`

| Today | Opaque |
|-------|--------|
| `{ type: "triggerReversal"; extraLines?: { allyId: string; anchor?: "tower" }[] }` | `{ type: "packCombat"; kind: "triggerReversal"; detail?: { extraLines?: { allyId: string; anchor?: "tower" }[] } }` |
| `{ type: "declineReversal" }` | `{ type: "packCombat"; kind: "declineReversal" }` (no detail) |

#### Engine-owned checklist (unchanged discriminants)

**PlayerAction:** `attack`, `shove`, `sprint`, `sprintMove`, `sprintCancel`, `weaponSwap`, `selectWeaponVariant`, `rez`, `resolveClassReaction`, `useEquipment`, `interact`, `commitHaste`.

**GmEnemyAction:** `move`, `attack`, `assisted`, `exhaust`.

### 6. Non-goals

- Runtime multi-pack / KV content packs
- A WS protocol version field on messages
- Implementing dual-read normalizers or handler rewrites (P1/P2) — runtime of those phases
- Campaign bag key rename (Opaque Peel C1) or client UX peels (U*)

`content-modules-api.ts` was deleted in **P3** (local typed `combatMod` helpers).

## Consequences

- Opaque Peel Program sequencing: P0 (this ADR) → P1 (`PlayerAction` pack + dual-read + client send) → P2 (`GmEnemyAction.swarmChip` + `packCombat`) → **P3 done** (delete `content-modules-api`) → **P4 done** (preview / combat pack bags; legacy mark/brand keys dropped after migrate).
- ADR 002’s “WS nesting under named `armorAction` / `weaponActive`” remains historically correct as the interim; **end state** is opaque `pack` / `packCombat` per this ADR.
- ADR 003 stamp machinery is reused for dual-read windows; protocol shrink is no longer “deferred parent #3.”
- ADR 007 product-coupling notes distinguish protocol vocabulary (this ADR, P1–P4) from module key strings at local `combatMod` call sites (façade removed in P3).
- No runtime code change in P0.
