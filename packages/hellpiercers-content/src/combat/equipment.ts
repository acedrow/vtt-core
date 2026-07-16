import type { PatternDirection } from "@gaem/shared";
import { coordKey, isInBounds, setTileTerrain, tileAt } from "@gaem/shared";
import { enemyLabel, playerLabel } from "@gaem/shared";
import {
  applyAttackToEnemies,
  applyDamageToEnemy,
  applyRangeAttackToEnemies,
  collectEnemyPatternAttackTiles,
  enemyPatternAttackSpec,
  resolveEnemyPatternOrigin,
  enemiesInTiles,
  enemyAttackDamage,
  enemyDirectAttackTargetEnemyIds,
  isDirectTargetEnemyAttack,
  manhattanDistance,
  resolveAttackWeapon,
  resetHeavenBurningLevelAfterAttack,
  resolveCombatAttackSpec,
  resolveRangeAttackTargetIds,
} from "@gaem/shared";
import { setTileEffect, applyEnemyEffectStacks } from "@gaem/shared";
import { enemyFootprintTiles, getEnemyAttacks, getEnemyScale } from "@gaem/shared";
import { buildBoardOccupancy, occupancyBlockedByEnemy } from "@gaem/shared";
import type { Enemy, GameState, Player } from "@gaem/shared";
import type { EnemyAttackSpec, PlayerAction, WeaponAttackSpec } from "@gaem/shared";
import {
  bespokeTilesInBounds,
  evaluateAnchoredPatternPlacement,
  isRangeTargetAttack,
  patternOriginFromAnchor,
  rangeTargetDistance,
  rangeTargetMax,
  usesAnchoredPatternPlacement,
} from "@gaem/shared";
import { dedupeSwarmTargetIds, swarmGroupForEnemy } from "./swarm.js";

export const HYLIC_ANNIHILATION_CORRIDOR = "Hylic Annihilation Corridor";
export const PROMETHEAN_GRADE_HYLIC_REJECTION_FIELD = "Promethean-Grade Hylic Rejection Field";
export const THOUGHT_GUIDING_REDIRECTION_CIRCUITS = "Thought-Guiding Redirection Circuits";
export const TRANSIENT_FORCE_PROJECTION = "Transient Force Projection";
export const ANNIHILATION_CORRIDOR_TILE_EFFECT = "AnnihilationCorridor";

const CORRIDOR_TILES: WeaponAttackSpec["tiles"] = [
  [0, 0],
  [1, 0],
  [2, 0],
  [3, 0],
  [4, 0],
];

const REJECTION_FIELD_RANGE = 6;
const REDIRECTION_RANGE = 5;
const FORCE_PROJECTION_RANGE = 3;
const COVER_TILE_COUNT = 3;

export function isHylicAnnihilationCorridor(name: string | undefined | null): boolean {
  return name === HYLIC_ANNIHILATION_CORRIDOR;
}

export function isHylicRejectionField(name: string | undefined | null): boolean {
  return name === PROMETHEAN_GRADE_HYLIC_REJECTION_FIELD;
}

export function isThoughtGuidingRedirectionCircuits(name: string | undefined | null): boolean {
  return name === THOUGHT_GUIDING_REDIRECTION_CIRCUITS;
}

export function isTransientForceProjection(name: string | undefined | null): boolean {
  return name === TRANSIENT_FORCE_PROJECTION;
}

export function equipmentRequiresBoardPlacement(name: string | undefined | null): boolean {
  return (
    isHylicAnnihilationCorridor(name) ||
    isHylicRejectionField(name) ||
    isThoughtGuidingRedirectionCircuits(name) ||
    isTransientForceProjection(name)
  );
}

export function getEquipmentAttackSpec(equipmentName: string | undefined): WeaponAttackSpec | null {
  if (!isHylicAnnihilationCorridor(equipmentName)) return null;
  return {
    tiles: CORRIDOR_TILES,
    anchorTile: [0, 0],
    damage: "0",
  };
}

export function collectEquipmentPatternTiles(
  state: GameState,
  anchor: { x: number; y: number },
  equipmentName: string,
  direction: PatternDirection,
): { x: number; y: number }[] {
  const spec = getEquipmentAttackSpec(equipmentName);
  if (!spec?.tiles?.length) return [];
  const origin = patternOriginFromAnchor(anchor, spec.anchorTile, direction);
  return bespokeTilesInBounds(
    origin,
    spec.tiles,
    direction,
    state.width,
    state.height,
  );
}

export function areOrthogonallyConnected(tiles: { x: number; y: number }[]): boolean {
  if (tiles.length <= 1) return true;
  const keys = new Set(tiles.map((t) => coordKey(t.x, t.y)));
  const start = tiles[0]!;
  const visited = new Set<string>([coordKey(start.x, start.y)]);
  const queue = [start];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const [dx, dy] of [
      [0, 1],
      [0, -1],
      [1, 0],
      [-1, 0],
    ] as const) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      const nk = coordKey(nx, ny);
      if (!keys.has(nk) || visited.has(nk)) continue;
      visited.add(nk);
      queue.push({ x: nx, y: ny });
    }
  }
  return visited.size === tiles.length;
}

function snapshotTileTerrain(state: GameState, x: number, y: number): void {
  if (!state.combat) return;
  const tile = tileAt(state.tiles, x, y);
  if (!tile) return;
  if (!state.combat.equipmentTerrainSnapshots) state.combat.equipmentTerrainSnapshots = [];
  if (state.combat.equipmentTerrainSnapshots.some((s) => s.x === x && s.y === y)) return;
  state.combat.equipmentTerrainSnapshots.push({ x, y, terrain: [...tile.terrain] });
}

export function clearEquipmentTerrainSnapshots(state: GameState): void {
  const snapshots = state.combat?.equipmentTerrainSnapshots;
  if (!snapshots?.length) return;
  for (const snap of snapshots) {
    const tile = tileAt(state.tiles, snap.x, snap.y);
    if (tile) tile.terrain = [...snap.terrain];
  }
  delete state.combat!.equipmentTerrainSnapshots;
}

function isTileUnoccupied(
  x: number,
  y: number,
  occ: ReturnType<typeof buildBoardOccupancy>,
): boolean {
  const key = coordKey(x, y);
  return !occ.playerByKey.has(key) && !occupancyBlockedByEnemy(occ, x, y);
}

export function validateHylicCorridorAction(
  state: GameState,
  player: Player,
  anchor: { x: number; y: number },
  direction: PatternDirection,
): string | null {
  if (!isHylicAnnihilationCorridor(player.equipment)) return "Invalid equipment";
  const spec = getEquipmentAttackSpec(player.equipment);
  if (!spec?.tiles?.length) return "Invalid equipment";
  const tiles = collectEquipmentPatternTiles(state, anchor, player.equipment!, direction);
  if (tiles.length < spec.tiles.length) return "Pattern out of bounds";
  return null;
}

export function validateHylicRejectionField(
  state: GameState,
  player: Player,
  coverTiles: { x: number; y: number }[],
): string | null {
  if (!isHylicRejectionField(player.equipment)) return "Invalid equipment";
  if (coverTiles.length !== COVER_TILE_COUNT) return `Select ${COVER_TILE_COUNT} tiles`;
  const seen = new Set<string>();
  for (const tile of coverTiles) {
    const key = coordKey(tile.x, tile.y);
    if (seen.has(key)) return "Duplicate tile";
    seen.add(key);
    if (!isInBounds(tile.x, tile.y, state.width, state.height)) return "Tile out of bounds";
    if (manhattanDistance(player, tile) > REJECTION_FIELD_RANGE) return "Tile out of range";
  }
  if (!areOrthogonallyConnected(coverTiles)) return "Tiles must be connected";
  return null;
}

export function isRedirectableEnemyAttack(spec: EnemyAttackSpec): boolean {
  if (isDirectTargetEnemyAttack(spec)) return true;
  return !!(spec.patternId && spec.size != null && spec.damage != null && spec.targeting === "pattern");
}

export function listRedirectableEnemyAttackIndices(enemyName: string): number[] {
  const attacks = getEnemyAttacks(enemyName);
  return attacks
    .map((entry, index) => (isRedirectableEnemyAttack(entry.attack) ? index : -1))
    .filter((index) => index >= 0);
}

function isSameEnemyOrSwarm(state: GameState, sourceId: string, targetId: string): boolean {
  if (sourceId === targetId) return true;
  const group = swarmGroupForEnemy(state, sourceId);
  return group?.memberIds.includes(targetId) ?? false;
}

export function validateRedirectionCircuits(
  state: GameState,
  player: Player,
  action: Extract<PlayerAction, { action: "useEquipment" }>,
): string | null {
  if (!isThoughtGuidingRedirectionCircuits(player.equipment)) return "Invalid equipment";
  if (!action.sourceEnemyId) return "Select source enemy";
  const source = state.enemies.find((e) => e.id === action.sourceEnemyId);
  if (!source || (source.hp ?? 0) <= 0) return "Unknown enemy";
  if (manhattanDistance(player, source) > REDIRECTION_RANGE) return "Enemy out of range";
  if (action.attackIndex == null) return "Select attack";
  const attackSpec = source.name ? getEnemyAttacks(source.name)[action.attackIndex]?.attack : undefined;
  if (!attackSpec) return "Invalid attack";
  if (!isRedirectableEnemyAttack(attackSpec)) return "Attack not supported";

  if (isDirectTargetEnemyAttack(attackSpec)) {
    if (!action.targetEnemyId) return "Select target enemy";
    if (isSameEnemyOrSwarm(state, source.id, action.targetEnemyId)) return "Invalid target";
    const validTargets = enemyDirectAttackTargetEnemyIds(state, source.id, attackSpec);
    if (!validTargets.includes(action.targetEnemyId)) return "Target out of range";
    return null;
  }

  if (!action.direction) return "Select direction";
  const spec = enemyPatternAttackSpec(attackSpec);
  if (!spec) return "Attack not supported";
  const origin = resolveEnemyPatternOrigin(
    source,
    spec.patternId,
    action.direction,
    action.anchorX != null && action.anchorY != null
      ? { x: action.anchorX, y: action.anchorY }
      : null,
  );
  if (!origin) return "Select pattern origin";
  const tiles = collectEnemyPatternAttackTiles(state, source, spec, action.direction, origin);
  const hits = enemiesInTiles(state, tiles).filter(
    (t) => !isSameEnemyOrSwarm(state, source.id, t.enemyId),
  );
  if (!hits.length) return "No enemy targets in pattern";
  return null;
}

type ForceProjectionAction = Extract<PlayerAction, { action: "useEquipment" }>;

export function validateForceProjection(
  state: GameState,
  player: Player,
  action: ForceProjectionAction,
): string | null {
  if (!isTransientForceProjection(player.equipment)) return "Invalid equipment";
  if (action.projectionX === undefined || action.projectionY === undefined) {
    return "Select projection square";
  }
  const { projectionX: x, projectionY: y } = action;
  if (!isInBounds(x, y, state.width, state.height)) return "Square out of bounds";
  if (manhattanDistance(player, { x, y }) > FORCE_PROJECTION_RANGE) return "Square out of range";
  const occ = buildBoardOccupancy(state);
  if (!isTileUnoccupied(x, y, occ)) return "Square must be empty";

  const weapon = resolveAttackWeapon(player, action.weaponName);
  if (!weapon) return "Invalid weapon";
  const spec = resolveCombatAttackSpec(player, weapon);
  if (!spec) return "Weapon has no attack profile";
  const origin = { x, y };

  if (isRangeTargetAttack(spec)) {
    const targetIds = resolveRangeAttackTargetIds(action);
    if (!targetIds.length) return "Select target";
    const maxTargets = rangeTargetMax(spec);
    if (targetIds.length > maxTargets) return `Too many targets (max ${maxTargets})`;
    for (const targetId of targetIds) {
      const enemy = state.enemies.find((e) => e.id === targetId);
      if (!enemy) return "Unknown target";
      if (manhattanDistance(origin, enemy) > rangeTargetDistance(spec)) return "Target out of range";
    }
  } else if (usesAnchoredPatternPlacement(spec)) {
    if (action.anchorX === undefined || action.anchorY === undefined) return "Select placement";
    const placement = evaluateAnchoredPatternPlacement(
      origin,
      { x: action.anchorX, y: action.anchorY },
      spec,
      action.direction ?? "n",
      state,
    );
    if (placement.tooFar) return "outside maximum range";
    if (placement.tooCloseKeys.size > 0) return "inside minimum range";
    if (!placement.valid) return "Placement out of range";
  } else if (!action.direction) {
    return "Select direction";
  }

  return null;
}

export function applyHylicCorridor(
  state: GameState,
  player: Player,
  anchor: { x: number; y: number },
  direction: PatternDirection,
): string {
  const tiles = collectEquipmentPatternTiles(state, anchor, player.equipment!, direction);
  for (const tile of tiles) {
    const mapTile = tileAt(state.tiles, tile.x, tile.y);
    if (mapTile) setTileEffect(mapTile, `${ANNIHILATION_CORRIDOR_TILE_EFFECT}:1`);
  }
  return `${tiles.length}-tile Annihilation Corridor`;
}

export function applyHylicRejectionField(
  state: GameState,
  coverTiles: { x: number; y: number }[],
): string {
  for (const tile of coverTiles) {
    snapshotTileTerrain(state, tile.x, tile.y);
    const mapTile = tileAt(state.tiles, tile.x, tile.y);
    // Layer Cover onto whatever terrain is already there instead of replacing it,
    // so e.g. an Advantageous tile keeps that terrain while also gaining Cover.
    if (mapTile && !mapTile.terrain.includes("cover")) {
      mapTile.terrain = [...mapTile.terrain.filter((t) => t !== "standard"), "cover"];
    }
  }
  return `${coverTiles.length} Cover tiles`;
}

export function applyRedirectionCircuits(
  state: GameState,
  player: Player,
  action: Extract<PlayerAction, { action: "useEquipment" }>,
): { message: string; hitEnemyIds: string[] } {
  const source = state.enemies.find((e) => e.id === action.sourceEnemyId)!;
  const attackSpec = source.name
    ? getEnemyAttacks(source.name)[action.attackIndex!]?.attack
    : undefined;
  if (!attackSpec) {
    return {
      message: `${playerLabel(player)} redirected ${enemyLabel(source)} attack (unsupported)`,
      hitEnemyIds: [],
    };
  }

  if (isDirectTargetEnemyAttack(attackSpec)) {
    const target = state.enemies.find((e) => e.id === action.targetEnemyId)!;
    const damage = enemyAttackDamage(attackSpec) ?? 0;
    applyDamageToEnemy(target, damage, state);
    if (attackSpec.effects) applyEnemyEffectStacks(state, target, attackSpec.effects);
    return {
      message: `${playerLabel(player)} redirected ${enemyLabel(source)} attack → ${enemyLabel(target)} for ${damage}`,
      hitEnemyIds: [target.id],
    };
  }

  const spec = enemyPatternAttackSpec(attackSpec);
  if (!spec) {
    return {
      message: `${playerLabel(player)} redirected ${enemyLabel(source)} attack (unsupported)`,
      hitEnemyIds: [],
    };
  }
  const origin = resolveEnemyPatternOrigin(
    source,
    spec.patternId,
    action.direction!,
    action.anchorX != null && action.anchorY != null
      ? { x: action.anchorX, y: action.anchorY }
      : null,
  );
  if (!origin) {
    return {
      message: `${playerLabel(player)} redirected ${enemyLabel(source)} attack (select pattern origin)`,
      hitEnemyIds: [],
    };
  }
  const tiles = collectEnemyPatternAttackTiles(state, source, spec, action.direction!, origin);
  const hits = enemiesInTiles(state, tiles).filter(
    (t) => !isSameEnemyOrSwarm(state, source.id, t.enemyId),
  );
  const damage = enemyAttackDamage(attackSpec) ?? 0;
  const names: string[] = [];
  const hitEnemyIds: string[] = [];
  for (const hit of hits) {
    const enemy = state.enemies.find((e) => e.id === hit.enemyId);
    if (!enemy) continue;
    applyDamageToEnemy(enemy, damage, state);
    if (attackSpec.effects) applyEnemyEffectStacks(state, enemy, attackSpec.effects);
    names.push(enemyLabel(enemy));
    hitEnemyIds.push(enemy.id);
  }
  return {
    message: `${playerLabel(player)} redirected ${enemyLabel(source)} attack → ${names.join(", ") || "no targets"} for ${damage}`,
    hitEnemyIds,
  };
}

export function applyForceProjection(
  state: GameState,
  player: Player,
  action: ForceProjectionAction,
): {
  message: string;
  result: ReturnType<typeof applyAttackToEnemies>;
  hitEnemyIds: string[];
} {
  const x = action.projectionX!;
  const y = action.projectionY!;
  const weapon = resolveAttackWeapon(player, action.weaponName)!;
  const spec = resolveCombatAttackSpec(player, weapon)!;
  const origin = { x, y };
  let result: ReturnType<typeof applyAttackToEnemies>;

  if (isRangeTargetAttack(spec)) {
    const rangeTargetIds = resolveRangeAttackTargetIds(action);
    const targetIds = action.useBreaker
      ? rangeTargetIds
      : dedupeSwarmTargetIds(state, rangeTargetIds);
    result = applyRangeAttackToEnemies(state, spec, targetIds, action.damageRoll, {
      useBreaker: action.useBreaker,
      weaponName: weapon,
    });
  } else {
    const direction = action.direction ?? "n";
    const attackOrigin =
      usesAnchoredPatternPlacement(spec) && action.anchorX != null && action.anchorY != null
        ? patternOriginFromAnchor({ x: action.anchorX, y: action.anchorY }, spec.anchorTile, direction)
        : origin;
    result = applyAttackToEnemies(
      state,
      spec,
      attackOrigin,
      direction,
      action.damageRoll,
      { useBreaker: action.useBreaker, weaponName: weapon },
    );
  }

  snapshotTileTerrain(state, x, y);
  const mapTile = tileAt(state.tiles, x, y);
  if (mapTile) setTileTerrain(mapTile, "void");

  const hitEnemyIds = result.targets.map((t) => t.enemyId);
  const names = hitEnemyIds
    .map((id) => state.enemies.find((e) => e.id === id))
    .filter(Boolean)
    .map((e) => enemyLabel(e!))
    .join(", ");
  const message = `${playerLabel(player)} Force Projection (${result.detail} dmg) → ${names || "no targets"}`;
  resetHeavenBurningLevelAfterAttack(player, weapon);
  return { message, result, hitEnemyIds };
}

export function enemyOnAnnihilationCorridor(state: GameState, enemy: Enemy): boolean {
  const scale = getEnemyScale(enemy);
  const footprint = enemyFootprintTiles(enemy.x, enemy.y, scale);
  for (const tile of footprint) {
    const mapTile = tileAt(state.tiles, tile.x, tile.y);
    if ((mapTile?.tileEffects?.[ANNIHILATION_CORRIDOR_TILE_EFFECT] ?? 0) > 0) return true;
  }
  return false;
}

export function applyAnnihilationCorridorEndOfTurnDamage(
  state: GameState,
  enemy: Enemy,
): string | null {
  if ((enemy.hp ?? 0) <= 0) return null;
  if (!enemyOnAnnihilationCorridor(state, enemy)) return null;
  applyDamageToEnemy(enemy, 1, state);
  return `${enemyLabel(enemy)} took 1 damage from Annihilation Corridor`;
}

export function clearAnnihilationCorridorTileEffects(state: GameState): void {
  for (const tile of state.tiles) {
    if (!tile.tileEffects?.[ANNIHILATION_CORRIDOR_TILE_EFFECT]) continue;
    delete tile.tileEffects[ANNIHILATION_CORRIDOR_TILE_EFFECT];
    if (Object.keys(tile.tileEffects).length === 0) delete tile.tileEffects;
  }
}

export function rejectionFieldTileKeys(
  state: GameState,
  player: { x: number; y: number },
): Set<string> {
  const keys = new Set<string>();
  for (let dy = -REJECTION_FIELD_RANGE; dy <= REJECTION_FIELD_RANGE; dy++) {
    for (let dx = -REJECTION_FIELD_RANGE; dx <= REJECTION_FIELD_RANGE; dx++) {
      if (Math.abs(dx) + Math.abs(dy) > REJECTION_FIELD_RANGE) continue;
      const x = player.x + dx;
      const y = player.y + dy;
      if (!isInBounds(x, y, state.width, state.height)) continue;
      keys.add(coordKey(x, y));
    }
  }
  return keys;
}

export function forceProjectionTileKeys(
  state: GameState,
  player: { x: number; y: number },
  occupancy: ReturnType<typeof buildBoardOccupancy>,
): Set<string> {
  const keys = new Set<string>();
  for (let dy = -FORCE_PROJECTION_RANGE; dy <= FORCE_PROJECTION_RANGE; dy++) {
    for (let dx = -FORCE_PROJECTION_RANGE; dx <= FORCE_PROJECTION_RANGE; dx++) {
      if (Math.abs(dx) + Math.abs(dy) > FORCE_PROJECTION_RANGE) continue;
      const x = player.x + dx;
      const y = player.y + dy;
      if (!isInBounds(x, y, state.width, state.height)) continue;
      if (!isTileUnoccupied(x, y, occupancy)) continue;
      keys.add(coordKey(x, y));
    }
  }
  return keys;
}

export function redirectionSourceTileKeys(
  state: GameState,
  player: { x: number; y: number },
): Set<string> {
  const keys = new Set<string>();
  for (const enemy of state.enemies) {
    if ((enemy.hp ?? 0) <= 0) continue;
    const scale = getEnemyScale(enemy);
    for (const tile of enemyFootprintTiles(enemy.x, enemy.y, scale)) {
      if (manhattanDistance(player, tile) > REDIRECTION_RANGE) continue;
      keys.add(coordKey(tile.x, tile.y));
    }
  }
  return keys;
}
