import type { Enemy, GameState, Player } from "@gaem/shared";
import { enemyLabel, playerLabel } from "@gaem/shared";
import {
  buildBoardOccupancy,
  isSandboxMode,
} from "@gaem/shared";
import { coordKey, isObstacleTile, tileAt } from "@gaem/shared";
import { applyDamageToEnemy, applyDamageToObstacle, applyDamageToPlayer } from "@gaem/shared";
import { rollDice } from "@gaem/shared";
import { applyEffectStacks, applyEnemyEffectStacks, applyTileEffectStacks, removeEffectStacks } from "@gaem/shared";
import type { BrandStripCandidate, BrandStripReaction } from "@gaem/shared";

export const CHRYSAOR_CLASS = "CHRYSAOR";
export const BRAND_EFFECT = "Brand";

export function obstacleBrandKey(x: number, y: number): string {
  return `obs:${x},${y}`;
}

export function ensureChrysaorCombatFields(state: GameState): boolean {
  if (!state.combat) return false;
  if (!state.combat.chrysaorBrands) state.combat.chrysaorBrands = {};
  return true;
}

export function isChrysaorClass(className: string | undefined): boolean {
  return className === CHRYSAOR_CLASS;
}

export function ownedBrandCandidates(state: GameState, ownerId: string): BrandStripCandidate[] {
  if (!ensureChrysaorCombatFields(state)) return [];
  const candidates: BrandStripCandidate[] = [];
  for (const [key, owner] of Object.entries(state.combat!.chrysaorBrands!)) {
    if (owner !== ownerId) continue;
    if (key.startsWith("obs:")) {
      const [, coords] = key.split(":");
      const [xs, ys] = (coords ?? "").split(",");
      const x = Number(xs);
      const y = Number(ys);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      const tile = tileAt(state.tiles, x, y);
      if (!tile || !isObstacleTile(tile) || (tile.tileEffects?.[BRAND_EFFECT] ?? 0) <= 0) continue;
      candidates.push({ kind: "obstacle", x, y });
      continue;
    }
    const enemy = state.enemies.find((e) => e.id === key);
    if (enemy && (enemy.effects?.[BRAND_EFFECT] ?? 0) > 0) {
      candidates.push({ kind: "enemy", id: key });
      continue;
    }
    const player = state.players.find((p) => p.id === key);
    if (player && (player.effects?.[BRAND_EFFECT] ?? 0) > 0) {
      candidates.push({ kind: "player", id: key });
    }
  }
  return candidates;
}

export function applySoulBranding(
  state: GameState,
  ownerId: string,
  target:
    | { kind: "enemy"; id: string }
    | { kind: "player"; id: string }
    | { kind: "obstacle"; x: number; y: number },
): string {
  if (!ensureChrysaorCombatFields(state)) return "No combat state";
  if (target.kind === "enemy") {
    const enemy = state.enemies.find((e) => e.id === target.id);
    if (!enemy) return "Unknown enemy";
    applyEnemyEffectStacks(state, enemy, [`${BRAND_EFFECT}:2`]);
    state.combat!.chrysaorBrands![enemy.id] = ownerId;
    return `${BRAND_EFFECT}:2 on ${enemyLabel(enemy)}`;
  }
  if (target.kind === "player") {
    const player = state.players.find((p) => p.id === target.id);
    if (!player) return "Unknown player";
    applyEffectStacks(player, [`${BRAND_EFFECT}:2`]);
    state.combat!.chrysaorBrands![player.id] = ownerId;
    return `${BRAND_EFFECT}:2 on ${playerLabel(player)}`;
  }
  const tile = tileAt(state.tiles, target.x, target.y);
  if (!tile || !isObstacleTile(tile)) return "Not an obstacle";
  applyTileEffectStacks(tile, [`${BRAND_EFFECT}:2`]);
  state.combat!.chrysaorBrands![obstacleBrandKey(target.x, target.y)] = ownerId;
  return `${BRAND_EFFECT}:2 on obstacle (${target.x}, ${target.y})`;
}

function clearBrandOwnership(state: GameState, key: string): void {
  if (!state.combat?.chrysaorBrands) return;
  delete state.combat.chrysaorBrands[key];
}

function adjacentDamage(
  state: GameState,
  center: { x: number; y: number },
  amount: number,
): string[] {
  const occ = buildBoardOccupancy(state);
  const messages: string[] = [];
  const hitPlayers = new Set<string>();
  const hitEnemies = new Set<string>();
  for (const [dx, dy] of [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ]) {
    const x = center.x + dx!;
    const y = center.y + dy!;
    const key = coordKey(x, y);
    const player = occ.playerByKey.get(key);
    if (player && !hitPlayers.has(player.id) && (player.hp ?? 0) > 0) {
      hitPlayers.add(player.id);
      const dealt = applyDamageToPlayer(player, amount, state);
      messages.push(`${playerLabel(player)} ${dealt}`);
    }
    const enemies = occ.enemiesByKey.get(key) ?? [];
    for (const enemy of enemies) {
      if (hitEnemies.has(enemy.id) || (enemy.hp ?? 0) <= 0) continue;
      hitEnemies.add(enemy.id);
      const dealt = applyDamageToEnemy(enemy, amount, state);
      messages.push(`${enemyLabel(enemy)} ${dealt}`);
    }
    const obsDealt = applyDamageToObstacle(state, x, y, amount);
    if (obsDealt > 0) messages.push(`obstacle (${x}, ${y}) ${obsDealt}`);
  }
  return messages;
}

export function detonateBrand(
  state: GameState,
  target:
    | { kind: "unit"; unit: Player | Enemy }
    | { kind: "obstacle"; x: number; y: number },
  rng = Math.random,
): string[] {
  const messages: string[] = [];
  const rolls = rollDice(4, 6, rng);
  const centerDamage = rolls.reduce((a, b) => a + b, 0);
  const rollDetail = rolls.join("+");

  if (target.kind === "unit") {
    const unit = target.unit;
    const key = unit.id;
    removeEffectStacks(unit, [`${BRAND_EFFECT}:${unit.effects?.[BRAND_EFFECT] ?? 0}`]);
    clearBrandOwnership(state, key);
    if ("class" in unit) {
      const dealt = applyDamageToPlayer(unit as Player, centerDamage, state);
      messages.push(`Brand detonated on ${playerLabel(unit as Player)} ${dealt} (${rollDetail})`);
    } else {
      const dealt = applyDamageToEnemy(unit as Enemy, centerDamage, state);
      messages.push(`Brand detonated on ${enemyLabel(unit as Enemy)} ${dealt} (${rollDetail})`);
    }
    messages.push(...adjacentDamage(state, unit, 6).map((m) => `adj ${m}`));
    return messages;
  }

  const { x, y } = target;
  const tile = tileAt(state.tiles, x, y);
  if (tile?.tileEffects?.[BRAND_EFFECT]) {
    delete tile.tileEffects[BRAND_EFFECT];
    if (Object.keys(tile.tileEffects).length === 0) delete tile.tileEffects;
  }
  clearBrandOwnership(state, obstacleBrandKey(x, y));
  const dealt = applyDamageToObstacle(state, x, y, centerDamage);
  messages.push(`Brand detonated on obstacle (${x}, ${y}) ${dealt} (${rollDetail})`);
  messages.push(...adjacentDamage(state, { x, y }, 6).map((m) => `adj ${m}`));
  return messages;
}

export function tickBrands(state: GameState, rng = Math.random): string[] {
  const messages: string[] = [];
  if (isSandboxMode(state)) return messages;
  ensureChrysaorCombatFields(state);

  const units: Array<Player | Enemy> = [...state.players, ...state.enemies];
  for (const unit of units) {
    const stacks = unit.effects?.[BRAND_EFFECT];
    if (!stacks) continue;
    const next = stacks - 1;
    if (next <= 0) {
      messages.push(...detonateBrand(state, { kind: "unit", unit }, rng));
    } else {
      unit.effects![BRAND_EFFECT] = next;
      messages.push(`Brand ${stacks} → ${next}`);
    }
  }

  for (const tile of state.tiles) {
    const stacks = tile.tileEffects?.[BRAND_EFFECT];
    if (!stacks) continue;
    const next = stacks - 1;
    if (next <= 0) {
      messages.push(...detonateBrand(state, { kind: "obstacle", x: tile.x, y: tile.y }, rng));
    } else {
      tile.tileEffects![BRAND_EFFECT] = next;
      messages.push(`Brand ${stacks} → ${next} at (${tile.x}, ${tile.y})`);
    }
  }
  return messages;
}

export function chrysaorImmuneToAreaEffects(unit: Player | Enemy): boolean {
  return "class" in unit && isChrysaorClass((unit as Player).class);
}

export function maybeOfferBrandStrip(state: GameState, player: Player): void {
  if (!isChrysaorClass(player.class)) return;
  if (!ensureChrysaorCombatFields(state)) return;
  if (state.combat!.pendingClassReaction) return;
  const candidates = ownedBrandCandidates(state, player.id);
  if (!candidates.length) return;
  const reaction: BrandStripReaction = {
    kind: "brand_strip",
    playerId: player.id,
    candidates,
  };
  state.combat!.pendingClassReaction = reaction;
}

export function stripOwnedBrand(
  state: GameState,
  ownerId: string,
  candidate: BrandStripCandidate,
): string {
  if (!ensureChrysaorCombatFields(state)) return "No combat state";
  if (candidate.kind === "enemy") {
    const enemy = state.enemies.find((e) => e.id === candidate.id);
    if (!enemy) return "Unknown enemy";
    if (state.combat!.chrysaorBrands![enemy.id] !== ownerId) return "Not your Brand";
    if ((enemy.effects?.[BRAND_EFFECT] ?? 0) <= 0) return "No Brand";
    removeEffectStacks(enemy, [`${BRAND_EFFECT}:1`]);
    if ((enemy.effects?.[BRAND_EFFECT] ?? 0) <= 0) clearBrandOwnership(state, enemy.id);
    return `Removed Brand:1 from ${enemyLabel(enemy)}`;
  }
  if (candidate.kind === "player") {
    const player = state.players.find((p) => p.id === candidate.id);
    if (!player) return "Unknown player";
    if (state.combat!.chrysaorBrands![player.id] !== ownerId) return "Not your Brand";
    if ((player.effects?.[BRAND_EFFECT] ?? 0) <= 0) return "No Brand";
    removeEffectStacks(player, [`${BRAND_EFFECT}:1`]);
    if ((player.effects?.[BRAND_EFFECT] ?? 0) <= 0) clearBrandOwnership(state, player.id);
    return `Removed Brand:1 from ${playerLabel(player)}`;
  }
  const key = obstacleBrandKey(candidate.x, candidate.y);
  if (state.combat!.chrysaorBrands![key] !== ownerId) return "Not your Brand";
  const tile = tileAt(state.tiles, candidate.x, candidate.y);
  if (!tile || (tile.tileEffects?.[BRAND_EFFECT] ?? 0) <= 0) return "No Brand";
  applyTileEffectStacks(tile, [`${BRAND_EFFECT}:-1`]);
  if ((tile.tileEffects?.[BRAND_EFFECT] ?? 0) <= 0) clearBrandOwnership(state, key);
  return `Removed Brand:1 from obstacle (${candidate.x}, ${candidate.y})`;
}
