import type { AuthCapabilities } from "../auth-capabilities.js";
import { hasGmCapabilities } from "../auth-capabilities.js";
import type { GameState, Player } from "../types.js";
import { isOrthogonallyAdjacent } from "../patterns.js";
import type { AttractorTile } from "./types.js";
import { applyPullToward, isAttractorVoidTile } from "./pull.js";
import { classGrantsDualGear } from "../campaign-registry.js";
import { getGearByName, getClassMaxHp } from "../player-data.js";
import { computeWalkable, tileAt } from "../map.js";

const ATTRACTOR_ZONE_RADIUS = 2;

function ensureCombatObjects(state: GameState): void {
  if (!state.combat) return;
  if (!state.combat.attractors) state.combat.attractors = [];
}

export function getAttractors(state: GameState): AttractorTile[] {
  return state.combat?.attractors ?? [];
}

export { isAttractorVoidTile };

export function tilesInAttractorZone(attractor: AttractorTile): { x: number; y: number }[] {
  const tiles: { x: number; y: number }[] = [];
  for (let dx = -ATTRACTOR_ZONE_RADIUS; dx <= ATTRACTOR_ZONE_RADIUS; dx++) {
    for (let dy = -ATTRACTOR_ZONE_RADIUS; dy <= ATTRACTOR_ZONE_RADIUS; dy++) {
      if (Math.abs(dx) + Math.abs(dy) <= ATTRACTOR_ZONE_RADIUS) {
        tiles.push({ x: attractor.x + dx, y: attractor.y + dy });
      }
    }
  }
  return tiles;
}

function applyVoidToAttractorTile(state: GameState, x: number, y: number): void {
  const tile = tileAt(state.tiles, x, y);
  if (!tile || tile.terrain.includes("void")) return;
  tile.terrain = [...tile.terrain, "void"];
  tile.walkable = computeWalkable(tile);
}

function clearVoidFromAttractorTile(state: GameState, x: number, y: number): void {
  const tile = tileAt(state.tiles, x, y);
  if (!tile) return;
  tile.terrain = tile.terrain.filter((t) => t !== "void");
  tile.walkable = computeWalkable(tile);
}

function removeAttractorFromState(state: GameState, attractor: AttractorTile): void {
  state.combat!.attractors = getAttractors(state).filter((a) => a.id !== attractor.id);
  if (attractor.void) clearVoidFromAttractorTile(state, attractor.x, attractor.y);
}

function removeAllAttractors(state: GameState): void {
  for (const a of [...getAttractors(state)]) removeAttractorFromState(state, a);
}

function sharurSpawnsVoidAttractor(owner: Player | undefined): boolean {
  if (!owner || owner.class !== "SHARUR") return false;
  const hp = owner.hp ?? getClassMaxHp(owner.class);
  return hp <= 10;
}

export function clearAttractorPullForEnemy(state: GameState, enemyId: string): void {
  if (!state.combat?.attractorPulledEnemyIds) return;
  state.combat.attractorPulledEnemyIds = state.combat.attractorPulledEnemyIds.filter((id) => id !== enemyId);
  if (!state.combat.attractorPulledEnemyIds.length) delete state.combat.attractorPulledEnemyIds;
}

function enemyAlreadyAttractorPulledThisTurn(state: GameState, enemyId: string): boolean {
  return (state.combat?.attractorPulledEnemyIds ?? []).includes(enemyId);
}

function markEnemyAttractorPulled(state: GameState, enemyId: string): void {
  if (!state.combat) return;
  if (!state.combat.attractorPulledEnemyIds) state.combat.attractorPulledEnemyIds = [];
  if (!state.combat.attractorPulledEnemyIds.includes(enemyId)) {
    state.combat.attractorPulledEnemyIds.push(enemyId);
  }
}

export function placeAttractor(
  state: GameState,
  ownerId: string,
  x: number,
  y: number,
): AttractorTile {
  ensureCombatObjects(state);
  removeAllAttractors(state);
  const owner = state.players.find((p) => p.id === ownerId);
  const isVoid = sharurSpawnsVoidAttractor(owner);
  const id = `attractor-${ownerId}-${x}-${y}-${Date.now()}`;
  const attractor: AttractorTile = { id, ownerId, x, y, void: isVoid };
  state.combat!.attractors!.push(attractor);
  if (isVoid) applyVoidToAttractorTile(state, x, y);
  return attractor;
}

export function getAttractorAt(state: GameState, x: number, y: number): AttractorTile | undefined {
  return getAttractors(state).find((a) => a.x === x && a.y === y);
}

export function validateRemoveAttractor(
  state: GameState,
  x: number,
  y: number,
  ctx: AuthCapabilities & { playerId: string | null },
): string | null {
  const attractor = getAttractorAt(state, x, y);
  if (!attractor) return "No attractor here";
  if (hasGmCapabilities(ctx)) return null;
  if (ctx.playerId && ctx.playerId === attractor.ownerId) return null;
  return "Not your attractor";
}

export function applyRemoveAttractor(state: GameState, x: number, y: number): string {
  const attractor = getAttractorAt(state, x, y);
  if (!attractor) return "No attractor here";
  removeAttractorFromState(state, attractor);
  const owner = state.players.find((p) => p.id === attractor.ownerId);
  const ownerName = owner?.nickname ?? attractor.ownerId;
  return `Removed attractor at (${x}, ${y}) · ${ownerName}`;
}

export function convertOwnerAttractorsToVoid(state: GameState, ownerId: string): number {
  let count = 0;
  for (const a of getAttractors(state)) {
    if (a.ownerId !== ownerId || a.void) continue;
    a.void = true;
    applyVoidToAttractorTile(state, a.x, a.y);
    count++;
  }
  return count;
}

function attractorsAffectingTile(state: GameState, x: number, y: number): AttractorTile[] {
  const hits: AttractorTile[] = [];
  for (const a of getAttractors(state)) {
    for (const t of tilesInAttractorZone(a)) {
      if (t.x === x && t.y === y) {
        hits.push(a);
        break;
      }
    }
  }
  return hits;
}

function applyAttractorPull(
  state: GameState,
  unit: Player | { id: string; x: number; y: number; hp?: number },
  kind: "player" | "enemy",
  endOfTurn: boolean,
): string[] {
  if (kind === "enemy" && enemyAlreadyAttractorPulledThisTurn(state, unit.id)) return [];
  const attractors = attractorsAffectingTile(state, unit.x, unit.y);
  if (!attractors.length) return [];
  const a = attractors[0]!;
  const msg = applyPullToward(state, unit as Player, a.x, a.y, 1, { kind });
  if (!msg) return [];
  if (kind === "enemy") markEnemyAttractorPulled(state, unit.id);
  return [endOfTurn ? `end-of-turn ${msg}` : msg];
}

export function applyAttractorEntryPulls(
  state: GameState,
  unit: Player | { id: string; x: number; y: number; hp?: number },
  kind: "player" | "enemy",
): string[] {
  return applyAttractorPull(state, unit, kind, false);
}

export function applyAttractorEndOfTurnPulls(
  state: GameState,
  unit: Player | { id: string; x: number; y: number; hp?: number },
  kind: "player" | "enemy",
): string[] {
  return applyAttractorPull(state, unit, kind, true);
}

export function checkSharurEmergencyDefenses(state: GameState, player: Player): string | null {
  if (player.class !== "SHARUR") return null;
  const hp = player.hp ?? getClassMaxHp(player.class);
  if (hp > 10) return null;
  if (!player.counters) player.counters = {};
  const alreadyTriggered = !!player.counters.sharurEmergencyTriggered;
  if (!alreadyTriggered) player.counters.sharurEmergencyTriggered = 1;
  const count = convertOwnerAttractorsToVoid(state, player.id);
  if (count) return `Emergency Auto Defenses — ${count} attractor(s) became Void`;
  if (!alreadyTriggered) return "Emergency Auto Defenses (no attractors)";
  return null;
}

export function grantVarunastraGearCheck(state: GameState, varunastra: Player): string[] {
  if (varunastra.class !== "VARUNASTRA") return [];
  if (!state.combat) return [];
  if (!state.combat.gearCheckGrants) state.combat.gearCheckGrants = {};
  const messages: string[] = [];
  for (const ally of state.players) {
    if (ally.id === varunastra.id) continue;
    if (!isOrthogonallyAdjacent(varunastra, ally)) continue;
    state.combat.gearCheckGrants[ally.id] = varunastra.id;
    messages.push(`Gear Check! → ${ally.nickname ?? ally.id} may free-swap`);
  }
  return messages;
}

export function playerArmorGearName(player: Player): string | undefined {
  if (player.gearArmor) return player.gearArmor;
  if (player.gear && getGearByName(player.gear)?.slot === "armor") return player.gear;
  return undefined;
}

export function playerWeaponGearName(player: Player): string | undefined {
  if (player.gear && getGearByName(player.gear)?.slot === "weapon") return player.gear;
  if (classGrantsDualGear(player.class) && player.gear) return player.gear;
  return undefined;
}
