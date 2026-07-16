import { getEffectStacking } from "../effects-data.js";
import type { EffectStacks, GameState, MapTile, Player, Enemy } from "../types.js";
import { buildBoardOccupancy, clampHp, getEnemyMaxHp, getPlayerMaxHp, isSandboxMode } from "../game.js";
import { coordKey, tileAt } from "../map.js";
import { clampAssistedAscensionAegis, hasAssistedAscensionGear } from "./aegis.js";
import { tickFallingStartOfTurn } from "./elevation.js";
import { swarmGroupForEnemy, swarmTilePositions } from "./content-modules-api.js";

export { tickRoundCountdowns } from "./countdown.js";

const ORTHO_DIRS: [number, number][] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

// Swarms are immune to effects that completely halt movement (rulebook p.100).
const SWARM_MOVEMENT_HALT_EFFECTS = new Set(["Pin"]);

export function parseEffectToken(token: string): { id: string; stacks: number } | null {
  const match = token.trim().match(/^([A-Za-z][A-Za-z ]*):(-?\d+)$/);
  if (!match) return null;
  return { id: match[1]!.trim(), stacks: Number(match[2]) };
}

export function filterSwarmHaltEffectTokens(tokens: string[]): string[] {
  return tokens.filter((token) => {
    const parsed = parseEffectToken(token);
    if (!parsed) return true;
    return !SWARM_MOVEMENT_HALT_EFFECTS.has(parsed.id);
  });
}

export function applyEffectStacks(
  target: { effects?: EffectStacks; counters?: Record<string, number> },
  tokens: string[],
): void {
  if (!target.effects) target.effects = {};
  for (const token of tokens) {
    const parsed = parseEffectToken(token);
    if (!parsed || parsed.stacks === 0) continue;
    if (
      parsed.id === "Blazing" &&
      parsed.stacks > 0 &&
      (target.counters?.warhookBlazingImmuneTurns ?? 0) > 0
    ) {
      continue;
    }
    const current = target.effects[parsed.id] ?? 0;
    const next =
      parsed.stacks > 0 && getEffectStacking(parsed.id) === "max"
        ? Math.max(current, parsed.stacks)
        : current + parsed.stacks;
    if (next <= 0) delete target.effects[parsed.id];
    else target.effects[parsed.id] = next;
  }
  if (Object.keys(target.effects).length === 0) delete target.effects;
  if (!("name" in target)) clampAssistedAscensionAegis(target as Player);
}

function swarmMembersOrSelf(state: GameState, enemy: Enemy): Enemy[] {
  const group = swarmGroupForEnemy(state, enemy.id);
  if (!group) return [enemy];
  const members: Enemy[] = [];
  for (const id of group.memberIds) {
    const member = state.enemies.find((e) => e.id === id);
    if (member) members.push(member);
  }
  return members.length ? members : [enemy];
}

// Swarms count as a single enemy for non-halt effects (rulebook p.100).
export function applyEnemyEffectStacks(state: GameState, enemy: Enemy, tokens: string[]): void {
  if (!tokens.length) return;
  const group = swarmGroupForEnemy(state, enemy.id);
  const filtered = group ? filterSwarmHaltEffectTokens(tokens) : tokens;
  if (!filtered.length) return;
  for (const member of swarmMembersOrSelf(state, enemy)) {
    applyEffectStacks(member, filtered);
  }
}

export function clearEnemyEffectStacks(state: GameState, enemy: Enemy): void {
  for (const member of swarmMembersOrSelf(state, enemy)) {
    clearEffectStacks(member);
  }
}

function syncSwarmEffectField(
  members: Enemy[],
  id: string,
  stacks: number | undefined,
): void {
  for (const member of members) {
    if (!member.effects) member.effects = {};
    if (stacks == null || stacks <= 0) delete member.effects[id];
    else member.effects[id] = stacks;
    if (Object.keys(member.effects).length === 0) delete member.effects;
  }
}

export function clearEffectStacks(target: { effects?: EffectStacks }): void {
  delete target.effects;
}

export function removeEffectStacks(target: { effects?: EffectStacks }, tokens: string[]): void {
  if (!target.effects) return;
  for (const token of tokens) {
    const parsed = parseEffectToken(token);
    if (!parsed) continue;
    const next = (target.effects[parsed.id] ?? 0) - parsed.stacks;
    if (next <= 0) delete target.effects[parsed.id];
    else target.effects[parsed.id] = next;
  }
  if (!("name" in target)) clampAssistedAscensionAegis(target as Player);
}

function dealDirectTickDamage(unit: Player | Enemy, amount: number, maxHp: number): void {
  if (amount <= 0 || unit.hp === undefined) return;
  const cap = maxHp > 0 ? maxHp : unit.hp;
  unit.hp = clampHp(unit.hp - amount, cap);
}

function dealTickDamage(
  state: GameState,
  unit: Player | Enemy,
  kind: "player" | "enemy",
  amount: number,
): void {
  if (amount <= 0) return;
  if (kind === "player") {
    dealDirectTickDamage(unit, amount, getPlayerMaxHp(unit as Player));
    return;
  }
  const enemy = unit as Enemy;
  const group = swarmGroupForEnemy(state, enemy.id);
  if (group) {
    const before = enemy.hp ?? group.maxHp;
    const newHp = clampHp(before - amount, group.maxHp);
    for (const member of swarmMembersOrSelf(state, enemy)) {
      member.hp = newHp;
    }
    return;
  }
  dealDirectTickDamage(enemy, amount, getEnemyMaxHp(enemy));
}

function unitHasBlazing(unit: Player | Enemy): boolean {
  return (unit.effects?.Blazing ?? 0) > 0;
}

function adjacentUnitsWithBlazing(state: GameState, unit: Player | Enemy): boolean {
  const occ = buildBoardOccupancy(state);
  for (const [dx, dy] of ORTHO_DIRS) {
    const key = coordKey(unit.x + dx, unit.y + dy);
    const other = occ.playerByKey.get(key) ?? occ.enemyByKey.get(key);
    if (other && other !== unit && unitHasBlazing(other)) return true;
  }
  return false;
}

function swarmAdjacentToExternalBlazing(state: GameState, memberIds: string[]): boolean {
  const memberSet = new Set(memberIds);
  const positions = swarmTilePositions(state, memberIds);
  const occ = buildBoardOccupancy(state);
  for (const pos of positions) {
    for (const [dx, dy] of ORTHO_DIRS) {
      const key = coordKey(pos.x + dx, pos.y + dy);
      const other = occ.playerByKey.get(key) ?? occ.enemyByKey.get(key);
      if (!other || !unitHasBlazing(other)) continue;
      if (!("class" in other) && memberSet.has((other as Enemy).id)) continue;
      return true;
    }
  }
  return false;
}

function hasExternalBlazingNeighbor(state: GameState, unit: Player | Enemy, kind: "player" | "enemy"): boolean {
  if (kind === "enemy") {
    const group = swarmGroupForEnemy(state, (unit as Enemy).id);
    if (group) return swarmAdjacentToExternalBlazing(state, group.memberIds);
  }
  return adjacentUnitsWithBlazing(state, unit);
}

export function tickUnitStartOfTurn(
  state: GameState,
  unit: Player | Enemy,
  kind: "player" | "enemy",
): string[] {
  const messages: string[] = [];
  if (isSandboxMode(state)) return messages;

  messages.push(...tickFallingStartOfTurn(state, unit, kind));

  // A unit that begins its turn adjacent to a Blazing unit catches fire too.
  if ((unit.effects?.Blazing ?? 0) <= 0 && hasExternalBlazingNeighbor(state, unit, kind)) {
    if (kind === "enemy") {
      applyEnemyEffectStacks(state, unit as Enemy, ["Blazing:1"]);
    } else {
      applyEffectStacks(unit, ["Blazing:1"]);
    }
    messages.push("Blazing spread from adjacent unit");
  }

  const blazing = unit.effects?.Blazing ?? 0;
  if (blazing > 0) {
    dealTickDamage(state, unit, kind, 1);
    messages.push("Blazing damage at start of turn");
  }

  if (kind === "player") {
    const player = unit as Player;
    const mapTile = tileAt(state.tiles, player.x, player.y);
    if ((mapTile?.tileEffects?.Fortified ?? 0) > 0) {
      delete mapTile!.tileEffects!.Fortified;
      if (Object.keys(mapTile!.tileEffects!).length === 0) delete mapTile!.tileEffects;
      player.reversalCharges = (player.reversalCharges ?? 0) + 2;
      messages.push("Fortified → +2 Reversal Charges");
    }
  }

  return messages;
}

const END_OF_TURN_EFFECTS = new Set([
  "Bleed",
  "Slow",
  "Pin",
  "Aegis",
  "Shock",
  "Bound",
  "Healing",
  "Armor",
  "Transference",
]);

export function tickUnitEndOfTurn(state: GameState, unit: Player | Enemy): string[] {
  const messages: string[] = [];
  if (isSandboxMode(state) || !unit.effects) return messages;

  const isPlayer = state.players.some((p) => p.id === unit.id);
  const enemy = isPlayer ? null : (unit as Enemy);
  const swarmMembers = enemy ? swarmMembersOrSelf(state, enemy) : null;
  const kind: "player" | "enemy" = enemy ? "enemy" : "player";

  const poison = unit.effects.Poison ?? 0;
  if (poison > 0) {
    dealTickDamage(state, unit, kind, poison);
    messages.push(`Poison ${poison} damage`);
    const nextPoison = poison - 1;
    if (swarmMembers) syncSwarmEffectField(swarmMembers, "Poison", nextPoison > 0 ? nextPoison : undefined);
    else if (nextPoison <= 0) delete unit.effects.Poison;
    else unit.effects.Poison = nextPoison;
  }

  const blazing = unit.effects.Blazing ?? 0;
  if (blazing > 0 && !hasExternalBlazingNeighbor(state, unit, kind)) {
    const next = blazing - 1;
    if (swarmMembers) syncSwarmEffectField(swarmMembers, "Blazing", next > 0 ? next : undefined);
    else if (next <= 0) delete unit.effects.Blazing;
    else unit.effects.Blazing = next;
    messages.push(`Blazing ${blazing} → ${next > 0 ? next : "removed"}`);
  }

  if (!unit.effects) return messages;

  for (const id of [...Object.keys(unit.effects)]) {
    if (!END_OF_TURN_EFFECTS.has(id)) continue;
    const before = unit.effects[id] ?? 0;
    if (id === "Aegis" && !enemy && hasAssistedAscensionGear(unit as Player) && before <= 1) {
      continue;
    }
    if (id === "Healing") {
      if (before > 0 && unit.hp !== undefined) {
        if (swarmMembers && enemy) {
          const group = swarmGroupForEnemy(state, enemy.id);
          const maxHp = group?.maxHp ?? getEnemyMaxHp(enemy);
          const nextHp = clampHp((unit.hp ?? maxHp) + before, maxHp);
          for (const member of swarmMembers) member.hp = nextHp;
        } else {
          const maxHp = isPlayer
            ? getPlayerMaxHp(unit as Player)
            : getEnemyMaxHp(unit as Enemy);
          unit.hp = clampHp(unit.hp + before, maxHp);
        }
        messages.push(`Healing restored ${before} HP`);
      }
    }
    const next = before - 1;
    if (swarmMembers) {
      syncSwarmEffectField(swarmMembers, id, next > 0 ? next : undefined);
    } else if (next <= 0) {
      delete unit.effects[id];
      if (before > 0) messages.push(`${id} ${before} → removed`);
    } else {
      unit.effects[id] = next;
      if (before !== next) messages.push(`${id} ${before} → ${next}`);
    }
    if (swarmMembers) {
      if (next <= 0) {
        if (before > 0) messages.push(`${id} ${before} → removed`);
      } else if (before !== next) {
        messages.push(`${id} ${before} → ${next}`);
      }
    }
    if (id === "Aegis" && !enemy) clampAssistedAscensionAegis(unit as Player);
  }
  if (swarmMembers) {
    for (const member of swarmMembers) {
      if (member.effects && Object.keys(member.effects).length === 0) delete member.effects;
    }
  } else if (unit.effects && Object.keys(unit.effects).length === 0) {
    delete unit.effects;
  }
  return messages;
}

export function applyBleedBonus(damage: number, effects?: EffectStacks): number {
  const bleed = effects?.Bleed ?? 0;
  return damage + bleed;
}

export function movementCostMultiplier(effects?: EffectStacks): number {
  return (effects?.Slow ?? 0) > 0 ? 2 : 1;
}

export function setTileEffect(tile: MapTile, token: string): void {
  applyTileEffectStacks(tile, [token]);
}

export function applyTileEffectStacks(tile: MapTile, tokens: string[]): void {
  for (const token of tokens) {
    const parsed = parseEffectToken(token);
    if (!parsed || parsed.stacks === 0) continue;
    if (!tile.tileEffects) tile.tileEffects = {};
    const current = tile.tileEffects[parsed.id] ?? 0;
    const next =
      parsed.stacks > 0 && getEffectStacking(parsed.id) === "max"
        ? Math.max(current, parsed.stacks)
        : current + parsed.stacks;
    if (next <= 0) delete tile.tileEffects[parsed.id];
    else tile.tileEffects[parsed.id] = next;
  }
  if (tile.tileEffects && Object.keys(tile.tileEffects).length === 0) delete tile.tileEffects;
}

export function clearTileEffects(tile: MapTile): void {
  delete tile.tileEffects;
}

export function replaceTileEffects(tile: MapTile, tokens: string[]): void {
  if (tokens.length === 0) {
    delete tile.tileEffects;
    return;
  }
  tile.tileEffects = {};
  applyTileEffectStacks(tile, tokens);
}

export function hasTileEffects(tile: MapTile | undefined): boolean {
  if (!tile?.tileEffects) return false;
  return Object.values(tile.tileEffects).some((stacks) => stacks > 0);
}
