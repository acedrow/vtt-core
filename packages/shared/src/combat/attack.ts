import type { PatternDirection } from "../pattern-data.js";
import { PATTERN_DIRECTIONS } from "../pattern-data.js";
import { fixedPatternTilesInBounds } from "../patterns.js";
import {
  bespokeTilesInBounds,
  parseAttackRangeSpan,
  patternOriginFromAnchor,
} from "../weapon-patterns.js";
import { getEnemyScale, enemyFootprintTiles } from "../enemy-data.js";
import { buildBoardOccupancy } from "../game.js";
import { coordKey, ensureObstacleHp, isInBounds, isObstacleTile, setTileTerrain, tileAt } from "../map.js";
import type { Enemy, GameState, MapTile, Player } from "../types.js";
import { getWeaponByName } from "../player-data.js";
import { combatMod } from "../combat-modules.js";
import type { AttackRangeSpan, EnemyAttackSpec, WeaponAttackSpec } from "./types.js";
import { applyEffectStacks, applyEnemyEffectStacks } from "./effects.js";
import { trackCountdownKinds } from "./countdown.js";
import { effectiveElevation, elevationAtCoords, tileElevation } from "./elevation.js";

export { tileElevation } from "./elevation.js";

function applyUnitEffectStacks(state: GameState, unit: Player | Enemy, effects: string[]): void {
  if (!effects.length) return;
  if (state.players.some((p) => p.id === unit.id)) applyEffectStacks(unit, effects);
  else applyEnemyEffectStacks(state, unit as Enemy, effects);
  trackCountdownKinds(state, unit, effects);
}
import {
  consumeBrokenStack,
  maxWeaponDamage,
  minWeaponDamage,
  parseAndRollDamage,
  resolveDamageAgainstTarget,
} from "./damage.js";
import { checkSharurEmergencyDefenses } from "./attractor.js";
import { clampHp, getEnemyMaxHp, getPlayerMaxHp, getEffectiveEnemyMaxHp, removeEnemy } from "../game.js";
import { maybeTriggerAgnosia } from "./agnosia.js";
import { tryChalazaorDamageNegation } from "./content-modules-api.js";
import { hasSpecialIdHandler } from "./special-id.js";
import { runEnemyDamageAdjustment } from "./combat-lifecycle.js";
import {
  countSwarmTilesAdjacentTo,
  getSwarmMemberHp,
  reconcileSwarmHp,
  snapshotSwarmGroups,
  swarmEnemyStrikeCap,
  swarmGroupForEnemy,
  swarmCanonicalDisplayId,
  swarmMembersHitByTiles,
  weaponHasBreakerTag,
} from "./content-modules-api.js";
import { isOrthogonallyAdjacent } from "../patterns.js";

export type AttackTarget = {
  enemyId: string;
  x: number;
  y: number;
};

export type OmnistrikePayload = {
  bombIndices: [number, number];
  anchors: [{ x: number; y: number }, { x: number; y: number }];
  direction: PatternDirection;
};

export type WarhookPayload = {
  targetEnemyId?: string;
  targetX: number;
  targetY: number;
  landingX: number;
  landingY: number;
  damageRoll?: number;
  useBreaker?: boolean;
};

export type WarhookTarget = {
  enemyId?: string;
  x: number;
  y: number;
};

export function resolveRangeAttackTargetIds(action: {
  targetEnemyId?: string;
  targetEnemyIds?: string[];
}): string[] {
  const ids = action.targetEnemyIds?.length
    ? action.targetEnemyIds
    : action.targetEnemyId
      ? [action.targetEnemyId]
      : [];
  return [...new Set(ids)];
}

export function resolveRangeAttackObstacleCoords(action: {
  targetObstacleCoords?: { x: number; y: number }[];
}): { x: number; y: number }[] {
  const coords = action.targetObstacleCoords ?? [];
  const seen = new Set<string>();
  const out: { x: number; y: number }[] = [];
  for (const c of coords) {
    const key = coordKey(c.x, c.y);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ x: c.x, y: c.y });
  }
  return out;
}

export function manhattanDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function enemiesInRange(
  state: GameState,
  origin: { x: number; y: number },
  range: number,
): AttackTarget[] {
  return state.enemies
    .filter((e) => {
      const d = manhattanDistance(origin, e);
      return d > 0 && d <= range;
    })
    .map((e) => ({ enemyId: e.id, x: e.x, y: e.y }));
}

type HeavenBurningModule = {
  HEAVEN_BURNING_SWORD_NAME: string;
  HEAVEN_BURNING_MIN_LEVEL: number;
  HEAVEN_BURNING_MAX_LEVEL: number;
  isHeavenBurningWeaponName: (name: string | undefined | null) => boolean;
  playerHasHeavenBurningWeapon: (player: Pick<Player, "weapon" | "weapon2">) => boolean;
  initHeavenBurningLevel: (player: Player) => void;
  ensureHeavenBurningLevel: (player: Player) => void;
  getHeavenBurningLevel: (player: Player) => number | null;
  resetHeavenBurningLevelAfterAttack: (player: Player, weaponName: string | undefined) => void;
  validateHeavenBurningUnfold: (player: Player) => string | null;
  applyHeavenBurningUnfold: (player: Player) => number;
};

function heavenBurning(): HeavenBurningModule {
  return combatMod("heavenBurning") as HeavenBurningModule;
}

type SabaothModule = {
  isSabaothWeaponName: (name: string | undefined | null) => boolean;
  playerHasSabaothWeapon: (player: Pick<Player, "weapon" | "weapon2">) => boolean;
  initSabaothCharges: (player: Player) => void;
  hasSabaothBombSelected: (player: Player | undefined) => boolean;
  ensureSabaothCharges: (player: Player) => void;
  getSabaothChargesRemaining: (player: Player) => number | null;
  applySabaothSquareEffects: (
    state: GameState,
    tiles: { x: number; y: number }[],
    effects: string[],
  ) => void;
  resolveOmnistrikePlacements: (
    state: GameState,
    player: Player,
    payload: OmnistrikePayload,
  ) => {
    bombSpecs: [WeaponAttackSpec, WeaponAttackSpec];
    combinedSpan: AttackRangeSpan;
    unionTiles: { x: number; y: number }[];
  } | null;
  validateOmnistrikeAction: (
    state: GameState,
    player: Player,
    payload: OmnistrikePayload,
  ) => string | null;
  applyOmnistrike: (
    state: GameState,
    player: Player,
    payload: OmnistrikePayload,
  ) => { message: string; targets: AttackTarget[] };
};

function sabaoth(): SabaothModule {
  return combatMod("sabaoth") as SabaothModule;
}

type SethianModule = {
  SETHIAN_WEAPON_NAME: string;
  SETHIAN_DAMAGE_CAP: number;
  WARHOOK_RANGE: number;
  isSethianWeaponName: (name: string | undefined | null) => boolean;
  isWarhookWeaponName: (name: string | undefined | null) => boolean;
  isWarhookTerrainTarget: (tile: MapTile | undefined) => boolean;
  warhookRangeKeys: (state: GameState, origin: { x: number; y: number }) => Set<string>;
  applySethianWholeSwarmAttack: (
    state: GameState,
    spec: WeaponAttackSpec,
    tiles: { x: number; y: number }[],
    damageRoll?: number,
    suppressEffects?: boolean,
  ) => { damage: number; detail: string; targets: AttackTarget[]; effects: string[] };
  isWarhookTargetAt: (
    state: GameState,
    player: Player,
    x: number,
    y: number,
  ) => WarhookTarget | null;
  warhookValidTargetKeys: (state: GameState, player: Player) => Set<string>;
  warhookAdjacentLandingTiles: (
    state: GameState,
    playerId: string,
    target: WarhookTarget,
  ) => { x: number; y: number }[];
  warhookNearestLandings: (
    player: Player,
    landings: { x: number; y: number }[],
  ) => { x: number; y: number }[];
  validateWarhookAction: (
    state: GameState,
    player: Player,
    payload: WarhookPayload,
  ) => string | null;
  applyWarhook: (
    state: GameState,
    player: Player,
    payload: WarhookPayload,
  ) => { message: string; detail: string; targets: AttackTarget[] };
};

function sethian(): SethianModule {
  return combatMod("sethian") as SethianModule;
}

export function isSabaothWeaponName(name: string | undefined | null): boolean {
  return sabaoth().isSabaothWeaponName(name);
}

export function playerHasSabaothWeapon(player: Pick<Player, "weapon" | "weapon2">): boolean {
  return sabaoth().playerHasSabaothWeapon(player);
}

export function initSabaothCharges(player: Player): void {
  sabaoth().initSabaothCharges(player);
}

export function hasSabaothBombSelected(player: Player | undefined): boolean {
  return sabaoth().hasSabaothBombSelected(player);
}

export function ensureSabaothCharges(player: Player): void {
  sabaoth().ensureSabaothCharges(player);
}

export function getSabaothChargesRemaining(player: Player): number | null {
  return sabaoth().getSabaothChargesRemaining(player);
}

export function isHeavenBurningWeaponName(name: string | undefined | null): boolean {
  return heavenBurning().isHeavenBurningWeaponName(name);
}

export function playerHasHeavenBurningWeapon(player: Pick<Player, "weapon" | "weapon2">): boolean {
  return heavenBurning().playerHasHeavenBurningWeapon(player);
}

export function initHeavenBurningLevel(player: Player): void {
  heavenBurning().initHeavenBurningLevel(player);
}

export function ensureHeavenBurningLevel(player: Player): void {
  heavenBurning().ensureHeavenBurningLevel(player);
}

export function getHeavenBurningLevel(player: Player): number | null {
  return heavenBurning().getHeavenBurningLevel(player);
}

export function resetHeavenBurningLevelAfterAttack(
  player: Player,
  weaponName: string | undefined,
): void {
  heavenBurning().resetHeavenBurningLevelAfterAttack(player, weaponName);
}

export function validateHeavenBurningUnfold(player: Player): string | null {
  return heavenBurning().validateHeavenBurningUnfold(player);
}

export function applyHeavenBurningUnfold(player: Player): number {
  return heavenBurning().applyHeavenBurningUnfold(player);
}

export function getWeaponAttackSpec(weaponName: string | undefined): WeaponAttackSpec | null {
  if (!weaponName) return null;
  const weapon = getWeaponByName(weaponName);
  if (!weapon?.attack) return null;
  return weapon.attack as WeaponAttackSpec;
}

export function resolveAttackWeapon(player: Player, weaponName?: string): string | null {
  const equipped = player.weapon ?? null;
  if (!equipped) return null;
  if (!weaponName || weaponName === equipped) return equipped;
  return null;
}

export function resolveCombatAttackSpec(
  player: Player | undefined,
  weaponName: string | undefined,
): WeaponAttackSpec | null {
  const spec = getWeaponAttackSpec(weaponName);
  if (!spec) return null;
  if (spec.levels?.length) {
    const levelIndex = Math.max(
      0,
      Math.min((player?.counters?.heavenBurningLevel ?? 1) - 1, spec.levels.length - 1),
    );
    const level = spec.levels[levelIndex] ?? spec.levels[0];
    if (level) {
      return {
        ...spec,
        damage: level.damage,
        tiles: level.tiles,
      };
    }
  }
  if (spec.bombs?.length) {
    const bombIndex = player?.counters?.sabaothBomb;
    if (bombIndex == null || bombIndex < 0) return null;
    const bomb = spec.bombs[bombIndex];
    if (!bomb) return null;
    return {
      ...spec,
      damage: bomb.damage,
      tiles: bomb.tiles,
      effects: bomb.effects,
      rangeSpan: parseAttackRangeSpan(bomb.range) ?? undefined,
      anchorTile: bomb.anchorTile,
      heal: bomb.heal,
    };
  }
  if (spec.tiles?.length || spec.rangeTargets || spec.rangeSpan || (spec.patternId && spec.size != null)) {
    return spec;
  }
  return spec;
}

export function playerAttackDirectionsAt(
  state: GameState,
  playerId: string,
  x: number,
  y: number,
  weaponName?: string,
): PatternDirection[] {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return [];
  const weapon = resolveAttackWeapon(player, weaponName) ?? player.weapon;
  const spec = resolveCombatAttackSpec(player, weapon);
  if (!player || !spec) return [];
  const origin = { x: player.x, y: player.y };
  const dirs: PatternDirection[] = [];
  for (const direction of PATTERN_DIRECTIONS) {
    const tiles = collectAttackTiles(state, origin, spec, direction);
    if (tiles.some((t) => t.x === x && t.y === y)) dirs.push(direction);
  }
  return dirs;
}

export function rangeAttackTileKeys(
  state: GameState,
  origin: { x: number; y: number },
  range: number,
): Set<string> {
  const keys = new Set<string>();
  for (let dy = -range; dy <= range; dy++) {
    for (let dx = -range; dx <= range; dx++) {
      if (dx === 0 && dy === 0) continue;
      if (Math.abs(dx) + Math.abs(dy) > range) continue;
      const x = origin.x + dx;
      const y = origin.y + dy;
      if (x < 0 || y < 0 || x >= state.width || y >= state.height) continue;
      keys.add(coordKey(x, y));
    }
  }
  return keys;
}

export function collectAttackTiles(
  state: GameState,
  origin: { x: number; y: number },
  spec: WeaponAttackSpec,
  direction: PatternDirection,
  elevationBonusTile?: { x: number; y: number },
  attacker?: Player | Enemy,
): { x: number; y: number }[] {
  let tiles: { x: number; y: number }[];
  if (spec.tiles?.length) {
    tiles = bespokeTilesInBounds(
      origin,
      spec.tiles,
      direction,
      state.width,
      state.height,
    );
  } else if (spec.rangeTargets || (spec.patternId === "range" && spec.range)) {
    return [];
  } else if (!spec.patternId || spec.size == null) {
    return [];
  } else {
    tiles = fixedPatternTilesInBounds(
      spec.patternId,
      origin,
      spec.size,
      direction,
      state.width,
      state.height,
      spec.range || spec.width
        ? { modifiers: { range: spec.range ?? 0, width: spec.width ?? 1, recoil: 0 } }
        : undefined,
    );
  }

  if (!elevationBonusTile) return tiles;
  const bonusKey = coordKey(elevationBonusTile.x, elevationBonusTile.y);
  if (tiles.some((t) => coordKey(t.x, t.y) === bonusKey)) return tiles;
  const candidates = elevationBonusTileCandidates(state, origin, tiles, attacker);
  if (!candidates.some((c) => coordKey(c.x, c.y) === bonusKey)) return tiles;
  return [...tiles, elevationBonusTile];
}

export function elevationRangeBonus(attackerElev: number, targetElev: number): number {
  return targetElev < attackerElev ? attackerElev : 0;
}

export function effectiveRangeLimit(
  state: GameState,
  origin: { x: number; y: number },
  baseRange: number,
  target: { x: number; y: number },
  opts?: { attacker?: Player | Enemy; targetUnit?: Player | Enemy },
): number {
  const attackerElev = opts?.attacker
    ? effectiveElevation(state, opts.attacker)
    : tileElevation(state, origin.x, origin.y);
  const targetUnit = opts?.targetUnit;
  const targetElev =
    targetUnit != null && targetUnit.x === target.x && targetUnit.y === target.y
      ? effectiveElevation(state, targetUnit)
      : elevationAtCoords(state, target.x, target.y);
  return baseRange + elevationRangeBonus(attackerElev, targetElev);
}

export function elevationBonusTileCandidates(
  state: GameState,
  origin: { x: number; y: number },
  patternTiles: { x: number; y: number }[],
  attacker?: Player | Enemy,
): { x: number; y: number }[] {
  const originElev = attacker
    ? effectiveElevation(state, attacker)
    : tileElevation(state, origin.x, origin.y);
  const hitEnemies = enemiesInTiles(state, patternTiles);
  const hasLowerEnemy = hitEnemies.some((t) => elevationAtCoords(state, t.x, t.y) < originElev);
  if (!hasLowerEnemy) return [];

  const patternKeys = new Set(patternTiles.map((t) => coordKey(t.x, t.y)));
  const candidates: { x: number; y: number }[] = [];
  const seen = new Set<string>();
  for (const tile of patternTiles) {
    for (const [dx, dy] of [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ]) {
      const x = tile.x + dx!;
      const y = tile.y + dy!;
      const key = coordKey(x, y);
      if (seen.has(key) || patternKeys.has(key)) continue;
      if (!isInBounds(x, y, state.width, state.height)) continue;
      if (tileElevation(state, x, y) >= originElev) continue;
      seen.add(key);
      candidates.push({ x, y });
    }
  }
  return candidates;
}

export function enemiesInTiles(
  state: GameState,
  tiles: { x: number; y: number }[],
  opts?: { dedupeSwarms?: boolean },
): AttackTarget[] {
  const dedupeSwarms = opts?.dedupeSwarms !== false;
  const occ = buildBoardOccupancy(state);
  const seen = new Set<string>();
  const seenSwarmGroups = new Set<string>();
  const targets: AttackTarget[] = [];
  for (const tile of tiles) {
    for (const enemy of occ.enemiesByKey.get(coordKey(tile.x, tile.y)) ?? []) {
      if (seen.has(enemy.id)) continue;
      if (dedupeSwarms) {
        const group = swarmGroupForEnemy(state, enemy.id);
        if (group) {
          const key = [...group.memberIds].sort().join(",");
          if (seenSwarmGroups.has(key)) continue;
          seenSwarmGroups.add(key);
          seen.add(enemy.id);
          targets.push({ enemyId: group.canonicalId, x: tile.x, y: tile.y });
          continue;
        }
      }
      seen.add(enemy.id);
      targets.push({ enemyId: enemy.id, x: tile.x, y: tile.y });
    }
  }
  return targets;
}

export function resolveAttackDamage(
  spec: WeaponAttackSpec,
  damageRoll?: number,
): { total: number; detail: string } {
  if (damageRoll !== undefined && Number.isFinite(damageRoll)) {
    const clamped = Math.min(
      maxWeaponDamage(spec.damage),
      Math.max(minWeaponDamage(spec.damage), Math.trunc(damageRoll)),
    );
    return { total: clamped, detail: String(clamped) };
  }
  return parseAndRollDamage(spec.damage);
}

export function applyDamageToEnemy(
  enemy: Enemy,
  damage: number,
  state?: GameState,
  opts?: {
    recordDamage?: boolean;
    damageSpec?: string;
    hitTile?: { x: number; y: number };
    piercing?: boolean;
  },
): number {
  if (state && damage > 0) {
    const negated = tryChalazaorDamageNegation(state, enemy);
    if (negated) return negated.dealt;
  }
  const maxHp = state ? getEffectiveEnemyMaxHp(enemy, state) : getEnemyMaxHp(enemy);
  const before = enemy.hp ?? maxHp;
  const adjusted = Math.max(
    0,
    resolveDamageAgainstTarget(
      damage,
      { effects: enemy.effects, x: enemy.x, y: enemy.y },
      {
        damageSpec: opts?.damageSpec,
        hitTile: opts?.hitTile,
        state,
        piercing: opts?.piercing,
      },
    ) + (state ? runEnemyDamageAdjustment(state, enemy) : 0),
  );
  consumeBrokenStack(enemy);
  const newHp = clampHp(before - adjusted, maxHp);
  if (state) {
    const group = swarmGroupForEnemy(state, enemy.id);
    if (group) {
      for (const id of group.memberIds) {
        const member = state.enemies.find((e) => e.id === id);
        if (member) member.hp = newHp;
      }
    } else {
      enemy.hp = newHp;
    }
    if (opts?.recordDamage !== false) {
      if (!state.damageEvents) state.damageEvents = [];
      if (group) {
        const displayId = swarmCanonicalDisplayId(state, group.memberIds);
        const anchor = state.enemies.find((e) => e.id === displayId) ?? enemy;
        let merged = false;
        for (const evt of state.damageEvents) {
          const atEnemy = state.enemies.find((e) => e.x === evt.x && e.y === evt.y);
          const evtGroup = atEnemy ? swarmGroupForEnemy(state, atEnemy.id) : null;
          if (evtGroup?.canonicalId === group.canonicalId) {
            evt.amount += adjusted;
            merged = true;
            break;
          }
        }
        if (!merged) {
          state.damageEvents.push({ x: anchor.x, y: anchor.y, amount: adjusted });
        }
      } else {
        state.damageEvents.push({ x: enemy.x, y: enemy.y, amount: adjusted });
      }
    }
    maybeTriggerAgnosia(state, enemy, before);
  } else {
    enemy.hp = newHp;
  }
  return adjusted;
}

export function applyBreakerAttackToSwarm(
  state: GameState,
  tiles: { x: number; y: number }[],
  damage: number,
  effects: string[] = [],
): { targets: AttackTarget[]; brokenIds: string[] } {
  const hits = swarmMembersHitByTiles(state, tiles);
  const brokenIds: string[] = [];
  const targets: AttackTarget[] = [];

  if (!hits.length) return { targets, brokenIds };

  const prev = snapshotSwarmGroups(state);
  const group = swarmGroupForEnemy(state, hits[0]!.enemyId);
  if (!group) return { targets, brokenIds };

  const memberHp = getSwarmMemberHp(group.currentHp, group.size);
  const primary = state.enemies.find((e) => e.id === group.canonicalId)!;
  const adjusted = resolveDamageAgainstTarget(
    damage,
    { effects: primary.effects, x: primary.x, y: primary.y },
    { state },
  );
  const allKilled = hits.every(() => adjusted >= memberHp);

  const recordHitDamage = () => {
    if (!state.damageEvents) state.damageEvents = [];
    for (const hit of hits) {
      state.damageEvents.push({ x: hit.x, y: hit.y, amount: adjusted });
    }
  };

  if (allKilled) {
    recordHitDamage();
    for (const hit of hits) {
      brokenIds.push(hit.enemyId);
      targets.push(hit);
      const enemy = state.enemies.find((e) => e.id === hit.enemyId);
      if (enemy) enemy.hp = 0;
    }
    // Removing squares from a Swarm reduces its pooled HP by their share before any
    // remaining members re-merge/split, rather than leaving survivors at the old total.
    const removedShare = memberHp * hits.length;
    const remainingPool = Math.max(0, group.currentHp - removedShare);
    for (const id of group.memberIds) {
      if (brokenIds.includes(id)) continue;
      const survivor = state.enemies.find((e) => e.id === id);
      if (survivor) survivor.hp = remainingPool;
    }
    reconcileSwarmHp(state, prev);
  } else {
    applyDamageToEnemy(primary, damage, state, { recordDamage: false, hitTile: { x: primary.x, y: primary.y } });
    recordHitDamage();
    targets.push({ enemyId: group.canonicalId, x: primary.x, y: primary.y });
    applyUnitEffectStacks(state,primary, effects);
  }

  return { targets, brokenIds };
}

export function applyDamageToPlayer(
  player: Player,
  damage: number,
  state?: GameState,
  opts?: {
    recordDamage?: boolean;
    damageSpec?: string;
    hitTile?: { x: number; y: number };
    piercing?: boolean;
  },
): number {
  const maxHp = getPlayerMaxHp(player);
  const before = player.hp ?? maxHp;
  const adjusted = resolveDamageAgainstTarget(
    damage,
    { effects: player.effects, x: player.x, y: player.y },
    {
      damageSpec: opts?.damageSpec,
      hitTile: opts?.hitTile,
      state,
      piercing: opts?.piercing,
    },
  );
  consumeBrokenStack(player);
  player.hp = clampHp(before - adjusted, maxHp);
  if (state) {
    checkSharurEmergencyDefenses(state, player);
  }
  if (state && opts?.recordDamage !== false) {
    if (!state.damageEvents) state.damageEvents = [];
    state.damageEvents.push({ x: player.x, y: player.y, amount: adjusted });
  }
  return adjusted;
}

export function applyDamageToObstacle(
  state: GameState,
  x: number,
  y: number,
  amount: number,
): number {
  const tile = tileAt(state.tiles, x, y);
  if (!tile || !isObstacleTile(tile)) return 0;
  const hp = ensureObstacleHp(tile);
  const dealt = Math.min(hp, Math.max(0, Math.trunc(amount)));
  if (dealt <= 0) return 0;
  const next = hp - dealt;
  if (next <= 0) {
    setTileTerrain(tile, "standard");
  } else {
    tile.obstacleHp = next;
  }
  if (!state.damageEvents) state.damageEvents = [];
  state.damageEvents.push({ x, y, amount: dealt });
  return dealt;
}

export function applyDamageToObstaclesInTiles(
  state: GameState,
  tiles: { x: number; y: number }[],
  amount: number,
): { x: number; y: number }[] {
  const hit: { x: number; y: number }[] = [];
  const seen = new Set<string>();
  for (const t of tiles) {
    const key = coordKey(t.x, t.y);
    if (seen.has(key)) continue;
    seen.add(key);
    if (applyDamageToObstacle(state, t.x, t.y, amount) > 0) hit.push({ x: t.x, y: t.y });
  }
  return hit;
}

export function applyAttackToEnemies(
  state: GameState,
  spec: WeaponAttackSpec,
  origin: { x: number; y: number },
  direction: PatternDirection,
  damageRoll?: number,
  opts?: {
    useBreaker?: boolean;
    weaponName?: string;
    elevationBonusTile?: { x: number; y: number };
    suppressEffects?: boolean;
  },
): { damage: number; detail: string; targets: AttackTarget[]; effects: string[] } {
  const tiles = collectAttackTiles(state, origin, spec, direction, opts?.elevationBonusTile);
  const { total, detail } = resolveAttackDamage(spec, damageRoll);
  const effects = opts?.suppressEffects ? [] : spec.effects ?? [];
  const useBreaker =
    !!opts?.useBreaker && weaponHasBreakerTag({ weapon: opts?.weaponName }, opts?.weaponName);

  if (useBreaker && swarmMembersHitByTiles(state, tiles).length) {
    const { targets } = applyBreakerAttackToSwarm(state, tiles, total, effects);
    applyDamageToObstaclesInTiles(state, tiles, total);
    return { damage: total, detail, targets, effects };
  }

  if (
    !useBreaker &&
    isSethianWeaponName(opts?.weaponName) &&
    swarmMembersHitByTiles(state, tiles).length
  ) {
    const result = applySethianWholeSwarmAttack(state, spec, tiles, damageRoll, opts?.suppressEffects);
    applyDamageToObstaclesInTiles(state, tiles, result.damage);
    return result;
  }

  const targets = enemiesInTiles(state, tiles);
  const damageOpts = { damageSpec: spec.damage };
  for (const target of targets) {
    const enemy = state.enemies.find((e) => e.id === target.enemyId);
    if (!enemy) continue;
    applyDamageToEnemy(enemy, total, state, { ...damageOpts, hitTile: { x: target.x, y: target.y } });
    applyUnitEffectStacks(state,enemy, effects);
  }
  applyDamageToObstaclesInTiles(state, tiles, total);
  if (isSabaothWeaponName(opts?.weaponName)) {
    sabaoth().applySabaothSquareEffects(state, tiles, effects);
  }
  return { damage: total, detail, targets, effects };
}

export function isSethianWeaponName(name: string | undefined | null): boolean {
  return sethian().isSethianWeaponName(name);
}

function applySethianWholeSwarmAttack(
  state: GameState,
  spec: WeaponAttackSpec,
  tiles: { x: number; y: number }[],
  damageRoll?: number,
  suppressEffects?: boolean,
): { damage: number; detail: string; targets: AttackTarget[]; effects: string[] } {
  return sethian().applySethianWholeSwarmAttack(state, spec, tiles, damageRoll, suppressEffects);
}

export function applyRangeAttackToEnemies(
  state: GameState,
  spec: WeaponAttackSpec,
  targetIds: string[],
  damageRoll?: number,
  opts?: {
    useBreaker?: boolean;
    weaponName?: string;
    obstacleCoords?: { x: number; y: number }[];
    suppressEffects?: boolean;
  },
): { damage: number; detail: string; targets: AttackTarget[]; effects: string[] } {
  const tiles = targetIds
    .map((id) => state.enemies.find((e) => e.id === id))
    .filter(Boolean)
    .map((e) => ({ x: e!.x, y: e!.y }));
  const obstacleCoords = opts?.obstacleCoords ?? [];
  const useBreaker =
    !!opts?.useBreaker && weaponHasBreakerTag({ weapon: opts?.weaponName }, opts?.weaponName);

  if (useBreaker && swarmMembersHitByTiles(state, tiles).length) {
    const { total, detail } = resolveAttackDamage(spec, damageRoll);
    const effects = opts?.suppressEffects ? [] : spec.effects ?? [];
    const targets: AttackTarget[] = [];
    for (const targetId of targetIds) {
      const enemy = state.enemies.find((e) => e.id === targetId)!;
      const group = swarmGroupForEnemy(state, targetId);
      if (group) {
        const { targets: broken } = applyBreakerAttackToSwarm(
          state,
          [{ x: enemy.x, y: enemy.y }],
          total,
          effects,
        );
        targets.push(...broken);
      } else {
        applyDamageToEnemy(enemy, total, state, { damageSpec: spec.damage, hitTile: { x: enemy.x, y: enemy.y } });
        applyUnitEffectStacks(state,enemy, effects);
        targets.push({ enemyId: enemy.id, x: enemy.x, y: enemy.y });
      }
    }
    applyDamageToObstaclesInTiles(state, obstacleCoords, total);
    return { damage: total, detail, targets, effects };
  }

  if (
    !useBreaker &&
    isSethianWeaponName(opts?.weaponName) &&
    swarmMembersHitByTiles(state, tiles).length
  ) {
    const result = applySethianWholeSwarmAttack(state, spec, tiles, damageRoll, opts?.suppressEffects);
    applyDamageToObstaclesInTiles(state, obstacleCoords, result.damage);
    return result;
  }

  const { total, detail } = resolveAttackDamage(spec, damageRoll);
  const effects = opts?.suppressEffects ? [] : spec.effects ?? [];
  const targets: AttackTarget[] = [];
  const damageOpts = { damageSpec: spec.damage };
  for (const targetId of targetIds) {
    const enemy = state.enemies.find((e) => e.id === targetId)!;
    applyDamageToEnemy(enemy, total, state, { ...damageOpts, hitTile: { x: enemy.x, y: enemy.y } });
    applyUnitEffectStacks(state,enemy, effects);
    targets.push({ enemyId: enemy.id, x: enemy.x, y: enemy.y });
  }
  applyDamageToObstaclesInTiles(state, obstacleCoords, total);
  return { damage: total, detail, targets, effects };
}

export type SwarmEnemyAttackPreview = {
  totalDamage: number;
  strikeCount: number;
  detail: string;
};

export function previewSwarmEnemyAttack(
  state: GameState,
  enemyId: string,
  spec: EnemyAttackSpec,
  targetPlayerId: string,
  opts?: { damage?: number; strikeCount?: number },
): SwarmEnemyAttackPreview {
  const group = swarmGroupForEnemy(state, enemyId);
  const memberIds = group?.memberIds ?? [enemyId];
  const target = state.players.find((p) => p.id === targetPlayerId);
  if (!target) return { totalDamage: 0, strikeCount: 0, detail: "No target" };

  const baseDamage = opts?.damage ?? enemyAttackDamage(spec) ?? 0;
  const adjacentCount = countSwarmTilesAdjacentTo(state, memberIds, target);
  if (adjacentCount === 0) return { totalDamage: 0, strikeCount: 0, detail: "Not adjacent" };

  const maxStrikes = Math.min(adjacentCount, swarmEnemyStrikeCap(1));
  const strikes = Math.min(Math.max(1, opts?.strikeCount ?? maxStrikes), maxStrikes);
  let remainingAdjacent = adjacentCount;
  let totalDamage = 0;
  for (let i = 0; i < strikes; i++) {
    if (i > 0) remainingAdjacent -= 1;
    totalDamage += baseDamage + remainingAdjacent;
  }
  return {
    totalDamage,
    strikeCount: strikes,
    detail: `${strikes} strike${strikes === 1 ? "" : "s"} (${baseDamage}+adj)`,
  };
}

function pickAdjacentSwarmMember(
  state: GameState,
  memberIds: string[],
  target: { x: number; y: number },
): string | null {
  for (const id of memberIds) {
    const enemy = state.enemies.find((e) => e.id === id);
    if (enemy && isOrthogonallyAdjacent(enemy, target)) return id;
  }
  return null;
}

export function applySwarmEnemyAttackToPlayer(
  state: GameState,
  enemyId: string,
  spec: EnemyAttackSpec,
  targetPlayerId: string,
  opts?: { damage?: number; strikeCount?: number },
): SwarmEnemyAttackPreview {
  const preview = previewSwarmEnemyAttack(state, enemyId, spec, targetPlayerId, opts);
  if (preview.strikeCount === 0) return preview;

  const group = swarmGroupForEnemy(state, enemyId);
  let memberIds = [...(group?.memberIds ?? [enemyId])];
  const target = state.players.find((p) => p.id === targetPlayerId)!;
  const baseDamage = opts?.damage ?? enemyAttackDamage(spec) ?? 0;
  let remainingAdjacent = countSwarmTilesAdjacentTo(state, memberIds, target);

  let totalDamage = 0;
  for (let i = 0; i < preview.strikeCount; i++) {
    if (i > 0) {
      const expendId = pickAdjacentSwarmMember(state, memberIds, target);
      if (expendId) {
        removeEnemy(state, expendId);
        memberIds = memberIds.filter((id) => id !== expendId);
        remainingAdjacent -= 1;
      }
    }
    const strikeDamage = baseDamage + remainingAdjacent;
    totalDamage += applyDamageToPlayer(target, strikeDamage, state, { recordDamage: false });
    if (spec.effects) applyUnitEffectStacks(state, target, spec.effects);
  }
  if (state && totalDamage > 0) {
    if (!state.damageEvents) state.damageEvents = [];
    state.damageEvents.push({ x: target.x, y: target.y, amount: totalDamage });
  }

  return preview;
}

export const OMNISTRIKE_DIRECTION: PatternDirection = "e";

export function resolveBombAttackSpec(
  weaponName: string | undefined,
  bombIndex: number,
): WeaponAttackSpec | null {
  const spec = getWeaponAttackSpec(weaponName);
  const bomb = spec?.bombs?.[bombIndex];
  if (!spec || !bomb) return null;
  return {
    ...spec,
    damage: bomb.damage,
    tiles: bomb.tiles,
    effects: bomb.effects,
    rangeSpan: parseAttackRangeSpan(bomb.range) ?? undefined,
    anchorTile: bomb.anchorTile,
    heal: bomb.heal,
  };
}

export function computeOmnistrikeRangeSpan(
  bombA: WeaponAttackSpec,
  bombB: WeaponAttackSpec,
): AttackRangeSpan | null {
  const spanA = bombA.rangeSpan;
  const spanB = bombB.rangeSpan;
  if (!spanA || !spanB) return null;
  return { min: Math.min(spanA.min, spanB.min), max: Math.max(spanA.max, spanB.max) };
}

export function collectBombPatternTiles(
  state: GameState,
  anchor: { x: number; y: number },
  bombSpec: WeaponAttackSpec,
  direction: PatternDirection = OMNISTRIKE_DIRECTION,
): { x: number; y: number }[] {
  const origin = patternOriginFromAnchor(anchor, bombSpec.anchorTile, direction);
  return bespokeTilesInBounds(
    origin,
    bombSpec.tiles!,
    direction,
    state.width,
    state.height,
  );
}

export function patternsAdjacentOrOverlap(
  tilesA: { x: number; y: number }[],
  tilesB: { x: number; y: number }[],
): boolean {
  const keysA = new Set(tilesA.map((t) => coordKey(t.x, t.y)));
  for (const tile of tilesB) {
    const key = coordKey(tile.x, tile.y);
    if (keysA.has(key)) return true;
    if (keysA.has(coordKey(tile.x + 1, tile.y))) return true;
    if (keysA.has(coordKey(tile.x - 1, tile.y))) return true;
    if (keysA.has(coordKey(tile.x, tile.y + 1))) return true;
    if (keysA.has(coordKey(tile.x, tile.y - 1))) return true;
  }
  return false;
}

export function unionPatternTiles(
  tilesA: { x: number; y: number }[],
  tilesB: { x: number; y: number }[],
): { x: number; y: number }[] {
  const seen = new Set<string>();
  const result: { x: number; y: number }[] = [];
  for (const tile of [...tilesA, ...tilesB]) {
    const key = coordKey(tile.x, tile.y);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(tile);
  }
  return result;
}

export type OmnistrikePlacement = {
  patternTiles: { x: number; y: number }[];
  combinedTiles: { x: number; y: number }[];
  nearestEmptySpaces: number;
  tooCloseKeys: Set<string>;
  tooFar: boolean;
  valid: boolean;
  adjacentToOther: boolean;
};

export function evaluateOmnistrikePlacement(
  user: { x: number; y: number },
  anchor: { x: number; y: number },
  bombSpec: WeaponAttackSpec,
  direction: PatternDirection,
  state: GameState,
  otherPatternTiles?: { x: number; y: number }[],
): OmnistrikePlacement {
  const patternTiles = collectBombPatternTiles(state, anchor, bombSpec, direction);
  const combinedTiles = otherPatternTiles?.length
    ? unionPatternTiles(otherPatternTiles, patternTiles)
    : patternTiles;

  // Each bomb's minimum/maximum range is checked against its own band, not a band
  // widened by whichever bomb it's being combined with.
  const span = bombSpec.rangeSpan ?? { min: 0, max: Infinity };
  let nearestDist = Infinity;
  const tooCloseKeys = new Set<string>();

  for (const tile of patternTiles) {
    const dist = manhattanDistance(user, tile);
    nearestDist = Math.min(nearestDist, dist);
    if (dist - 1 < span.min) {
      tooCloseKeys.add(coordKey(tile.x, tile.y));
    }
  }

  const nearestEmptySpaces = nearestDist === Infinity ? Infinity : nearestDist - 1;
  const tooFar = nearestEmptySpaces > span.max;
  const adjacentToOther = !otherPatternTiles?.length || patternsAdjacentOrOverlap(otherPatternTiles, patternTiles);
  const valid =
    patternTiles.length > 0 &&
    !tooFar &&
    tooCloseKeys.size === 0 &&
    adjacentToOther;

  return {
    patternTiles,
    combinedTiles,
    nearestEmptySpaces,
    tooCloseKeys,
    tooFar,
    valid,
    adjacentToOther,
  };
}

export function resolveOmnistrikePlacements(
  state: GameState,
  player: Player,
  payload: OmnistrikePayload,
): { bombSpecs: [WeaponAttackSpec, WeaponAttackSpec]; combinedSpan: AttackRangeSpan; unionTiles: { x: number; y: number }[] } | null {
  return sabaoth().resolveOmnistrikePlacements(state, player, payload);
}

export function validateOmnistrikeAction(
  state: GameState,
  player: Player,
  payload: OmnistrikePayload,
): string | null {
  return sabaoth().validateOmnistrikeAction(state, player, payload);
}

export function applyOmnistrike(
  state: GameState,
  player: Player,
  payload: OmnistrikePayload,
): { message: string; targets: AttackTarget[] } {
  return sabaoth().applyOmnistrike(state, player, payload);
}

export const WARHOOK_RANGE = 3;

export function isWarhookWeaponName(name: string | undefined | null): boolean {
  return sethian().isWarhookWeaponName(name);
}

export function isWarhookTerrainTarget(tile: MapTile | undefined): boolean {
  return sethian().isWarhookTerrainTarget(tile);
}

export function warhookRangeKeys(
  state: GameState,
  origin: { x: number; y: number },
): Set<string> {
  return sethian().warhookRangeKeys(state, origin);
}

export function isWarhookTargetAt(
  state: GameState,
  player: Player,
  x: number,
  y: number,
): WarhookTarget | null {
  return sethian().isWarhookTargetAt(state, player, x, y);
}

export function warhookValidTargetKeys(
  state: GameState,
  player: Player,
): Set<string> {
  return sethian().warhookValidTargetKeys(state, player);
}

export function warhookAdjacentLandingTiles(
  state: GameState,
  playerId: string,
  target: WarhookTarget,
): { x: number; y: number }[] {
  return sethian().warhookAdjacentLandingTiles(state, playerId, target);
}

export function warhookNearestLandings(
  player: Player,
  landings: { x: number; y: number }[],
): { x: number; y: number }[] {
  return sethian().warhookNearestLandings(player, landings);
}

export function validateWarhookAction(
  state: GameState,
  player: Player,
  payload: WarhookPayload,
): string | null {
  return sethian().validateWarhookAction(state, player, payload);
}

export function applyWarhook(
  state: GameState,
  player: Player,
  payload: WarhookPayload,
): { message: string; detail: string; targets: AttackTarget[] } {
  return sethian().applyWarhook(state, player, payload);
}


export function enemyAttackDamage(spec: EnemyAttackSpec): number | undefined {
  if (spec.damage == null || spec.damage === "") return undefined;
  const n = Number(spec.damage);
  return Number.isFinite(n) ? n : undefined;
}

export function isDirectTargetEnemyAttack(spec: EnemyAttackSpec): boolean {
  return spec.targeting === "select" && enemyAttackDamage(spec) != null;
}

export function enemyAttackPushDistance(spec: EnemyAttackSpec): number | null {
  for (const token of spec.effects ?? []) {
    const m = token.match(/^Push:(\d+)$/i);
    if (m) return Number(m[1]);
  }
  return null;
}

export function enemyAttackPullDistance(spec: EnemyAttackSpec): number | null {
  for (const token of spec.effects ?? []) {
    const m = token.match(/^Pull:(\d+)$/i);
    if (m) return Number(m[1]);
  }
  for (const hit of spec.onHit ?? []) {
    if (hit.kind === "pullTowardActor") return hit.distance;
  }
  return null;
}

export function enemyAttackNonPushEffects(spec: EnemyAttackSpec): string[] {
  return (spec.effects ?? []).filter((token) => !/^(Push|Pull):/i.test(token));
}

export function isSelectTargetEnemyAttack(spec: EnemyAttackSpec): boolean {
  return spec.targeting === "select";
}

export function isPatternEnemyAttack(spec: EnemyAttackSpec): boolean {
  return (
    spec.targeting === "pattern" &&
    !!spec.patternId &&
    spec.size != null &&
    spec.damage != null
  );
}

export function isAutoResolvableEnemyAttack(spec: EnemyAttackSpec): boolean {
  if (hasSpecialIdHandler(spec.specialId)) return true;
  if (isPatternEnemyAttack(spec)) return true;
  return isSelectTargetEnemyAttack(spec);
}

export function enemyPatternAttackSpec(spec: EnemyAttackSpec): {
  patternId: string;
  size: number;
  range?: number;
  width: number;
  damage: string;
} | null {
  if (!isPatternEnemyAttack(spec) || !spec.patternId || spec.size == null || spec.damage == null) {
    return null;
  }
  return {
    patternId: spec.patternId,
    size: spec.size,
    range: spec.range,
    width: spec.width ?? 1,
    damage: spec.damage,
  };
}

function isDirectionalEnemyPattern(patternId: string): boolean {
  return (
    patternId === "cone" ||
    patternId === "line" ||
    patternId === "blast" ||
    patternId === "charge" ||
    patternId === "wall"
  );
}

export function enemyPatternOrigins(
  enemy: Enemy,
  direction: PatternDirection,
  patternId: string,
): { x: number; y: number }[] {
  const scale = getEnemyScale(enemy);
  const footprint = enemyFootprintTiles(enemy.x, enemy.y, scale);
  if (scale <= 1 || !isDirectionalEnemyPattern(patternId)) return footprint;
  switch (direction) {
    case "n":
      return footprint.filter((t) => t.y === enemy.y);
    case "s":
      return footprint.filter((t) => t.y === enemy.y + scale - 1);
    case "w":
      return footprint.filter((t) => t.x === enemy.x);
    case "e":
      return footprint.filter((t) => t.x === enemy.x + scale - 1);
  }
}

export function collectEnemyPatternAttackTiles(
  state: GameState,
  enemy: Enemy,
  spec: {
    patternId: string;
    size: number;
    range?: number;
    width?: number;
    damage: string;
  },
  direction: PatternDirection,
  origin: { x: number; y: number },
): { x: number; y: number }[] {
  const footprintKeys = new Set(
    enemyFootprintTiles(enemy.x, enemy.y, getEnemyScale(enemy)).map((t) => coordKey(t.x, t.y)),
  );
  const tiles: { x: number; y: number }[] = [];
  const seen = new Set<string>();
  for (const tile of collectAttackTiles(state, origin, spec, direction)) {
    const key = coordKey(tile.x, tile.y);
    if (footprintKeys.has(key) || seen.has(key)) continue;
    seen.add(key);
    tiles.push(tile);
  }
  return tiles;
}

export type EnemyPatternAimOption = {
  direction: PatternDirection;
  origin: { x: number; y: number };
};

export function enemyAttackPatternOptionsAt(
  state: GameState,
  enemyId: string,
  attackSpec: EnemyAttackSpec,
  x: number,
  y: number,
): EnemyPatternAimOption[] {
  const enemy = state.enemies.find((e) => e.id === enemyId);
  const spec = enemyPatternAttackSpec(attackSpec);
  if (!enemy || !spec) return [];
  const options: EnemyPatternAimOption[] = [];
  for (const direction of PATTERN_DIRECTIONS) {
    for (const origin of enemyPatternOrigins(enemy, direction, spec.patternId)) {
      const tiles = collectEnemyPatternAttackTiles(state, enemy, spec, direction, origin);
      if (tiles.some((t) => t.x === x && t.y === y)) {
        options.push({ direction, origin });
      }
    }
  }
  return options;
}

export function enemyAttackDirectionsAt(
  state: GameState,
  enemyId: string,
  attackSpec: EnemyAttackSpec,
  x: number,
  y: number,
): PatternDirection[] {
  const dirs = new Set<PatternDirection>();
  for (const option of enemyAttackPatternOptionsAt(state, enemyId, attackSpec, x, y)) {
    dirs.add(option.direction);
  }
  return [...dirs];
}

export function resolveEnemyPatternOrigin(
  enemy: Enemy,
  patternId: string,
  direction: PatternDirection,
  origin?: { x: number; y: number } | null,
): { x: number; y: number } | null {
  const valid = enemyPatternOrigins(enemy, direction, patternId);
  if (origin) {
    return valid.some((o) => o.x === origin.x && o.y === origin.y) ? origin : null;
  }
  return valid.length === 1 ? valid[0]! : null;
}

function enemyAttackOriginTiles(state: GameState, enemyId: string): { x: number; y: number }[] {
  const group = swarmGroupForEnemy(state, enemyId);
  if (group) {
    return group.memberIds.flatMap((id) => {
      const e = state.enemies.find((en) => en.id === id);
      return e ? [{ x: e.x, y: e.y }] : [];
    });
  }
  const enemy = state.enemies.find((e) => e.id === enemyId);
  if (!enemy) return [];
  return enemyFootprintTiles(enemy.x, enemy.y, getEnemyScale(enemy));
}

export function enemyDirectAttackTargetPlayerIds(
  state: GameState,
  enemyId: string,
  spec: EnemyAttackSpec,
  occupancy?: ReturnType<typeof buildBoardOccupancy>,
): string[] {
  const range = spec.range ?? 1;
  const occ = occupancy ?? buildBoardOccupancy(state);
  const ids = new Set<string>();

  if (spec.adjacent) {
    const sourceTiles = enemyAttackOriginTiles(state, enemyId);
    for (const player of state.players) {
      if ((player.hp ?? 0) <= 0) continue;
      const adjacent = sourceTiles.some((st) => isOrthogonallyAdjacent(st, player));
      if (adjacent) ids.add(player.id);
    }
    return [...ids];
  }

  for (const origin of enemyAttackOriginTiles(state, enemyId)) {
    for (const key of rangeAttackTileKeys(state, origin, range)) {
      const p = occ.playerByKey.get(key);
      if (p) ids.add(p.id);
    }
  }
  return [...ids];
}

export function enemyDirectAttackTargetEnemyIds(
  state: GameState,
  sourceEnemyId: string,
  spec: EnemyAttackSpec,
  occupancy?: ReturnType<typeof buildBoardOccupancy>,
): string[] {
  const range = spec.range ?? 1;
  const occ = occupancy ?? buildBoardOccupancy(state);
  const sourceGroup = swarmGroupForEnemy(state, sourceEnemyId);
  const sourceCanonical = sourceGroup?.canonicalId ?? sourceEnemyId;
  const ids = new Set<string>();

  if (spec.adjacent) {
    const sourceTiles = enemyAttackOriginTiles(state, sourceEnemyId);
    for (const enemy of state.enemies) {
      if ((enemy.hp ?? 0) <= 0) continue;
      const targetCanonical = swarmGroupForEnemy(state, enemy.id)?.canonicalId ?? enemy.id;
      if (targetCanonical === sourceCanonical) continue;
      const targetTiles = enemyFootprintTiles(enemy.x, enemy.y, getEnemyScale(enemy));
      const adjacent = sourceTiles.some((st) =>
        targetTiles.some((tt) => isOrthogonallyAdjacent(st, tt)),
      );
      if (adjacent) ids.add(targetCanonical);
    }
    return [...ids];
  }

  for (const origin of enemyAttackOriginTiles(state, sourceEnemyId)) {
    for (const key of rangeAttackTileKeys(state, origin, range)) {
      const enemy = occ.enemyByKey.get(key);
      if (!enemy || (enemy.hp ?? 0) <= 0) continue;
      const targetCanonical = swarmGroupForEnemy(state, enemy.id)?.canonicalId ?? enemy.id;
      if (targetCanonical === sourceCanonical) continue;
      ids.add(targetCanonical);
    }
  }
  return [...ids];
}
