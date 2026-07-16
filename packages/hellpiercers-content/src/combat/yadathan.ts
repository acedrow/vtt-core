import type { Enemy, GameState, Player, TerrainObject } from "@gaem/shared";
import {
  addEnemy,
  buildBoardOccupancy,
  clampHp,
  getEnemyMaxHp,
  getPlayerMaxHp,
  isSandboxMode,
  occupancyBlockedByEnemy,
  removeEnemy,
} from "@gaem/shared";
import { getYadathanTower } from "../sheet-data.js";
import { getEnemyScale, enemyFootprintTiles } from "@gaem/shared";
import { coordKey, isInBounds, isWalkable, tileAt } from "@gaem/shared";
import { isOrthogonallyAdjacent } from "@gaem/shared";
import { getArmorByName } from "@gaem/shared";
import { applyDamageToEnemy, manhattanDistance, rangeAttackTileKeys } from "@gaem/shared";
import { applyEffectStacks, applyEnemyEffectStacks } from "@gaem/shared";
import { tilesOnSegment } from "@gaem/shared";

export const YADATHAN_ARMOR_NAME = "YADATHAN";
export const TOWER_KATAPTY = "Katapty";
export const TOWER_KERAUNO = "Kerauno";
export const TOWER_HERMNDION = "Hermńdion";
export const TOWER_IATROS = "Iatrós";

export const YADATHAN_TOWER_NAMES = [
  TOWER_KATAPTY,
  TOWER_KERAUNO,
  TOWER_HERMNDION,
  TOWER_IATROS,
] as const;

export type YadathanTowerName = (typeof YADATHAN_TOWER_NAMES)[number];

export type YadathanTowerDef = {
  name: string;
  hp: number;
  scale: number;
  tags: string;
  special: string;
};

function newEntityId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function isYadathanArmorName(name: string | undefined | null): boolean {
  return name === YADATHAN_ARMOR_NAME;
}

export function getPlayerYadathanTowerName(player: Player): string | undefined {
  return getYadathanTower(player);
}

export function isValidYadathanTowerName(name: string | undefined | null): name is YadathanTowerName {
  return !!name && (YADATHAN_TOWER_NAMES as readonly string[]).includes(name);
}

export function getYadathanTowerDef(towerName: string): YadathanTowerDef | undefined {
  const armor = getArmorByName(YADATHAN_ARMOR_NAME);
  const tower = armor?.towers?.find((t) => t.name === towerName);
  if (!tower) return undefined;
  return {
    name: tower.name,
    hp: tower.hp,
    scale: tower.scale ?? 1,
    tags: tower.tags,
    special: tower.special,
  };
}

export function isTowerEnemy(enemy: Enemy): boolean {
  return enemy.kind === "tower";
}

export function getPlayerTower(state: GameState, playerId: string): Enemy | undefined {
  return state.enemies.find((e) => e.kind === "tower" && e.ownerPlayerId === playerId);
}

export function getHermndionTowers(state: GameState): Enemy[] {
  return state.enemies.filter((e) => e.kind === "tower" && e.name === TOWER_HERMNDION);
}

export function yadathanPlacementKeys(
  state: GameState,
  player: Player,
  range: number,
): Set<string> {
  const keys = rangeAttackTileKeys(state, player, range);
  const occ = buildBoardOccupancy(state);
  const valid = new Set<string>();
  for (const key of keys) {
    const [xs, ys] = key.split(",");
    const x = Number(xs);
    const y = Number(ys);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    if (!isWalkable(tileAt(state.tiles, x, y))) continue;
    if (occ.playerByKey.has(key) || occupancyBlockedByEnemy(occ, x, y)) continue;
    valid.add(key);
  }
  return valid;
}

export function towerTeleportLandingKeys(state: GameState, playerId: string): Set<string> {
  const tower = getPlayerTower(state, playerId);
  if (!tower) return new Set();
  const occ = buildBoardOccupancy(state);
  const keys = new Set<string>();
  for (const delta of [
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
  ]) {
    const x = tower.x + delta.dx;
    const y = tower.y + delta.dy;
    if (!isInBounds(x, y, state.width, state.height)) continue;
    const key = coordKey(x, y);
    if (!isWalkable(tileAt(state.tiles, x, y))) continue;
    const occupant = occ.playerByKey.get(key);
    if (occupant && occupant.id !== playerId) continue;
    if (occupancyBlockedByEnemy(occ, x, y)) continue;
    keys.add(key);
  }
  return keys;
}

export function keraunoAdjacentEnemyIds(state: GameState, landingX: number, landingY: number): string[] {
  const occ = buildBoardOccupancy(state);
  const ids: string[] = [];
  for (const delta of [
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
  ]) {
    const x = landingX + delta.dx;
    const y = landingY + delta.dy;
    const enemy = occ.enemyByKey.get(coordKey(x, y));
    if (enemy && !isTowerEnemy(enemy)) ids.push(enemy.id);
  }
  return ids;
}

export function validatePlaceTower(
  state: GameState,
  player: Player,
  x: number,
  y: number,
  range: number,
): string | null {
  if (!isYadathanArmorName(player.armor)) return "Not wearing YADATHAN";
  const towerName = getPlayerYadathanTowerName(player);
  if (!towerName || !getYadathanTowerDef(towerName)) return "No tower type selected";
  if (manhattanDistance(player, { x, y }) > range) return "Out of range";
  if (!isInBounds(x, y, state.width, state.height)) return "Out of bounds";
  const key = coordKey(x, y);
  if (!yadathanPlacementKeys(state, player, range).has(key)) return "Invalid placement";
  return null;
}

export function applyPlaceTower(
  state: GameState,
  player: Player,
  x: number,
  y: number,
): { message: string; towerName: string } | { error: string } {
  const towerName = getPlayerYadathanTowerName(player);
  if (!towerName) return { error: "No tower type selected" };
  const def = getYadathanTowerDef(towerName);
  if (!def) return { error: "Unknown tower type" };

  const existing = getPlayerTower(state, player.id);
  if (existing) removeEnemy(state, existing.id);

  const id = newEntityId("tower");
  const err = addEnemy(state, {
    id,
    x,
    y,
    name: def.name,
    hp: def.hp,
    scale: def.scale,
    kind: "tower",
    ownerPlayerId: player.id,
    speed: 0,
    exhausted: true,
  });
  if (err) return { error: err };
  return { message: `placed ${def.name} at (${x}, ${y})`, towerName: def.name };
}

export function validateTowerTeleport(
  state: GameState,
  player: Player,
  x: number,
  y: number,
  keraunoTargetEnemyId?: string,
): string | null {
  if (!isYadathanArmorName(player.armor)) return "Not wearing YADATHAN";
  const tower = getPlayerTower(state, player.id);
  if (!tower) return "No tower on the battlefield";
  const landings = towerTeleportLandingKeys(state, player.id);
  if (!landings.has(coordKey(x, y))) return "Invalid landing tile";
  if ((player.actionBudget?.movementRemaining ?? 0) <= 0) return "No movement remaining";
  if (tower.name === TOWER_KERAUNO) {
    const adjacent = keraunoAdjacentEnemyIds(state, x, y);
    if (adjacent.length > 0 && !keraunoTargetEnemyId) return "Select adjacent enemy for Kerauno";
    if (keraunoTargetEnemyId && !adjacent.includes(keraunoTargetEnemyId)) return "Invalid Kerauno target";
  }
  return null;
}

export function applyTowerTeleport(
  state: GameState,
  player: Player,
  x: number,
  y: number,
  keraunoTargetEnemyId?: string,
): string {
  const tower = getPlayerTower(state, player.id)!;
  if (player.actionBudget) player.actionBudget.movementRemaining = 0;
  player.x = x;
  player.y = y;

  let msg = `teleported adjacent to ${tower.name ?? "tower"}`;
  if (tower.name === TOWER_KERAUNO && keraunoTargetEnemyId) {
    const enemy = state.enemies.find((e) => e.id === keraunoTargetEnemyId);
    if (enemy) {
      applyDamageToEnemy(enemy, 5, state);
      applyEnemyEffectStacks(state, enemy, ["Pin:2"]);
      msg += `; Kerauno hit ${enemy.name ?? "enemy"} for 5 + Pin:2`;
    }
  }
  return msg;
}

export function enemyDistanceFrom(origin: { x: number; y: number }, enemy: Enemy): number {
  let min = manhattanDistance(origin, enemy);
  for (const tile of enemyFootprintTiles(enemy.x, enemy.y, getEnemyScale(enemy))) {
    min = Math.min(min, manhattanDistance(origin, tile));
  }
  return min;
}

function isEnemyAlive(enemy: Enemy): boolean {
  const maxHp = getEnemyMaxHp(enemy);
  return (enemy.hp ?? maxHp) > 0;
}

export function enemiesInRangeOf(
  state: GameState,
  origin: { x: number; y: number },
  range: number,
): Enemy[] {
  return state.enemies.filter(
    (e) => !isTowerEnemy(e) && isEnemyAlive(e) && enemyDistanceFrom(origin, e) <= range,
  );
}

export function resolveKataptyTargetIds(
  state: GameState,
  playerId: string,
  selectedIds?: string[],
): { ids: string[] } | { error: string } {
  const tower = getPlayerTower(state, playerId);
  if (!tower || tower.name !== TOWER_KATAPTY) return { error: "No Katapty tower" };
  const inRange = enemiesInRangeOf(state, tower, 4);
  if (inRange.length === 0) return { ids: [] };
  if (inRange.length <= 3) {
    return { ids: inRange.map((e) => e.id) };
  }
  if (!selectedIds?.length) return { error: "Select exactly 3 enemies" };
  if (selectedIds.length !== 3) {
    return { error: `Select exactly 3 enemies (${inRange.length} in range)` };
  }
  for (const id of selectedIds) {
    if (!inRange.some((e) => e.id === id)) return { error: "Target out of range" };
  }
  return { ids: selectedIds };
}

export function applyKataptyStrike(state: GameState, tower: Enemy, targetIds: string[]): string {
  const hits: string[] = [];
  for (const id of targetIds.slice(0, 3)) {
    const enemy = state.enemies.find((e) => e.id === id);
    if (!enemy || isTowerEnemy(enemy) || !isEnemyAlive(enemy)) continue;
    if (enemyDistanceFrom(tower, enemy) > 4) continue;
    applyDamageToEnemy(enemy, 1, state);
    hits.push(enemy.name ?? "enemy");
  }
  return hits.length ? `Katapty hit ${hits.join(", ")}` : "Katapty found no targets";
}

export function applyHermndionAdjacentHaste(state: GameState, player: Player): string | null {
  for (const tower of getHermndionTowers(state)) {
    if (isOrthogonallyAdjacent({ x: player.x, y: player.y }, { x: tower.x, y: tower.y })) {
      applyEffectStacks(player, ["Haste:1"]);
      return "Hermńdion granted Haste:1";
    }
  }
  return null;
}

export function findIatrosSeedTile(
  state: GameState,
  tower: Enemy,
): { x: number; y: number } | null {
  const occ = buildBoardOccupancy(state);
  const rangeKeys = rangeAttackTileKeys(state, tower, 2);
  for (const key of rangeKeys) {
    const [xs, ys] = key.split(",");
    const x = Number(xs);
    const y = Number(ys);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    if (!isWalkable(tileAt(state.tiles, x, y))) continue;
    if (occ.playerByKey.has(key) || occupancyBlockedByEnemy(occ, x, y)) continue;
    const objects = occ.terrainObjectsByKey.get(key) ?? [];
    if (objects.some((o) => o.kind === "seed")) continue;
    return { x, y };
  }
  return null;
}

export function applyIatrosSeed(state: GameState, tower: Enemy, ownerPlayerId: string): string | null {
  const tile = findIatrosSeedTile(state, tower);
  if (!tile) return null;
  if (!state.terrainObjects) state.terrainObjects = [];
  state.terrainObjects.push({
    id: newEntityId("seed"),
    x: tile.x,
    y: tile.y,
    name: "Seed",
    kind: "seed",
    ownerPlayerId,
  });
  return `Iatrós placed Seed at (${tile.x}, ${tile.y})`;
}

export function getSeedAt(state: GameState, x: number, y: number): TerrainObject | undefined {
  return state.terrainObjects?.find((o) => o.kind === "seed" && o.x === x && o.y === y);
}

export function validateSeedInteract(state: GameState, player: Player): string | null {
  const seed = getSeedAt(state, player.x, player.y);
  if (!seed) return null;
  return null;
}

export function applySeedInteract(state: GameState, player: Player): string | null {
  const seed = getSeedAt(state, player.x, player.y);
  if (!seed) return null;
  state.terrainObjects = (state.terrainObjects ?? []).filter((o) => o.id !== seed.id);
  player.hp = clampHp((player.hp ?? 0) + 5, getPlayerMaxHp(player));
  return "picked up Seed (+5 HP)";
}

export function yadathanReversalEligible(state: GameState, playerId: string): boolean {
  return !!getPlayerTower(state, playerId);
}

export function applyYadathanReversal(
  state: GameState,
  player: Player,
  incomingDamage: number,
  extraLines: { allyId: string; anchor?: "tower" }[] = [],
): string {
  const tower = getPlayerTower(state, player.id);
  if (!tower) return "No tower for reversal";

  const lines: { from: { x: number; y: number }; to: { x: number; y: number }; iatros: boolean }[] = [
    { from: { x: player.x, y: player.y }, to: { x: tower.x, y: tower.y }, iatros: tower.name === TOWER_IATROS },
  ];
  for (const { allyId, anchor } of extraLines) {
    const ally = state.players.find((p) => p.id === allyId);
    if (!ally) continue;
    lines.push({
      from: anchor === "tower" ? { x: tower.x, y: tower.y } : { x: player.x, y: player.y },
      to: { x: ally.x, y: ally.y },
      iatros: tower.name === TOWER_IATROS,
    });
  }

  const occ = buildBoardOccupancy(state);
  const hitEnemies = new Set<string>();
  const healedPlayers = new Set<string>();
  const dmg = incomingDamage > 0 ? incomingDamage : 1;

  for (const line of lines) {
    const tiles = tilesOnSegment(line.from, line.to);
    for (const tile of tiles) {
      const key = coordKey(tile.x, tile.y);
      if (line.iatros) {
        const ally = occ.playerByKey.get(key);
        if (ally && !healedPlayers.has(ally.id)) {
          healedPlayers.add(ally.id);
          ally.hp = clampHp((ally.hp ?? 0) + dmg, getPlayerMaxHp(ally));
        }
      } else {
        const enemy = occ.enemyByKey.get(key);
        if (enemy && !isTowerEnemy(enemy) && !hitEnemies.has(enemy.id)) {
          hitEnemies.add(enemy.id);
          applyDamageToEnemy(enemy, dmg, state);
        }
      }
    }
  }

  const parts: string[] = [];
  if (hitEnemies.size) parts.push(`damaged ${hitEnemies.size} enemies on line(s)`);
  if (healedPlayers.size) parts.push(`healed ${healedPlayers.size} allies on line(s)`);
  return parts.length ? parts.join("; ") : "Reversal resolved (no units on line(s))";
}

export function resolveYadathanEndOfTurn(state: GameState, player: Player): string[] {
  if (isSandboxMode(state)) return [];
  const messages: string[] = [];
  const tower = getPlayerTower(state, player.id);
  if (tower) {
    if (tower.name === TOWER_KATAPTY && !player.counters?.kataptyResolved) {
      const resolved = resolveKataptyTargetIds(state, player.id);
      if ("ids" in resolved && resolved.ids.length > 0) {
        messages.push(applyKataptyStrike(state, tower, resolved.ids));
      }
    }
    if (tower.name === TOWER_IATROS) {
      const seedMsg = applyIatrosSeed(state, tower, player.id);
      if (seedMsg) messages.push(seedMsg);
    }
  }
  const hermMsg = applyHermndionAdjacentHaste(state, player);
  if (hermMsg) messages.push(hermMsg);
  return messages;
}

export function kataptyNeedsTargetPick(state: GameState, playerId: string): boolean {
  const tower = getPlayerTower(state, playerId);
  if (!tower || tower.name !== TOWER_KATAPTY) return false;
  return enemiesInRangeOf(state, tower, 4).length > 3;
}

export function kataptyTargetKeys(state: GameState, playerId: string): Set<string> {
  const tower = getPlayerTower(state, playerId);
  if (!tower) return new Set();
  const keys = new Set<string>();
  for (const enemy of enemiesInRangeOf(state, tower, 4)) {
    keys.add(coordKey(enemy.x, enemy.y));
  }
  return keys;
}

export function validateKataptyEndTurn(
  state: GameState,
  player: Player,
  targetEnemyIds?: string[],
): string | null {
  const tower = getPlayerTower(state, player.id);
  if (!tower || tower.name !== TOWER_KATAPTY) return "No Katapty tower";
  if (enemiesInRangeOf(state, tower, 4).length <= 3) return "Katapty auto-resolves on end turn";
  const resolved = resolveKataptyTargetIds(state, player.id, targetEnemyIds);
  return "error" in resolved ? resolved.error : null;
}
