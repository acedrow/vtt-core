import type { PatternDirection } from "../pattern-data.js";
import { enemyLabel, playerLabel } from "../console.js";
import { buildBoardOccupancy } from "../game.js";
import { coordKey } from "../map.js";
import type { Enemy, GameState, Player } from "../types.js";
import {
  applyDamageToEnemy,
  applyDamageToPlayer,
  collectEnemyPatternAttackTiles,
  enemyAttackDamage,
  enemyAttackNonPushEffects,
  enemyAttackPullDistance,
  enemyAttackPushDistance,
  enemyPatternAttackSpec,
  resolveEnemyPatternOrigin,
} from "./attack.js";
import type { EnemyAttackSpec } from "./types.js";
import { parseAndRollDamage } from "./damage.js";
import { applyEffectStacks, applyEnemyEffectStacks } from "./effects.js";
import { trackCountdownKinds } from "./countdown.js";
import { combatMod } from "../combat-modules.js";
import { applyPullToward } from "./pull.js";
import { applyPushFromOrigin } from "./push.js";
import { swarmGroupForEnemy } from "./swarm.js";

type ChrysaorModule = {
  chrysaorImmuneToAreaEffects: (unit: Player | Enemy) => boolean;
  maybeOfferBrandStrip: (state: GameState, player: Player) => void;
};

function chrysaor(): ChrysaorModule {
  return combatMod("chrysaor") as ChrysaorModule;
}

function chrysaorImmuneToAreaEffects(unit: Player | Enemy): boolean {
  return chrysaor().chrysaorImmuneToAreaEffects(unit);
}

function maybeOfferBrandStrip(state: GameState, player: Player): void {
  chrysaor().maybeOfferBrandStrip(state, player);
}

type StainwalkModule = {
  stainMapTile: (state: GameState, x: number, y: number) => boolean;
};

function stainwalk(): StainwalkModule {
  return combatMod("stainwalk") as StainwalkModule;
}

function stainMapTile(state: GameState, x: number, y: number): boolean {
  return stainwalk().stainMapTile(state, x, y);
}

function applyStacks(
  state: GameState,
  unit: Player | Enemy,
  effects: string[],
  source?: Enemy,
  opts?: { areaAttack?: boolean },
): void {
  if (!effects.length) return;
  if ((source?.effects?.Bound ?? 0) > 0) return;
  if (opts?.areaAttack && chrysaorImmuneToAreaEffects(unit)) return;
  if (state.players.some((p) => p.id === unit.id)) applyEffectStacks(unit, effects);
  else applyEnemyEffectStacks(state, unit as Enemy, effects);
  trackCountdownKinds(state, unit, effects);
}

export function applyPatternEnemyAttack(
  state: GameState,
  enemy: Enemy,
  attackSpec: EnemyAttackSpec,
  direction: PatternDirection,
  opts?: {
    damage?: number;
    origin?: { x: number; y: number };
    onPlayerHit?: (playerId: string) => void;
  },
): string {
  const spec = enemyPatternAttackSpec(attackSpec);
  if (!spec) {
    return `${enemyLabel(enemy)} attack (no pattern)`;
  }
  const origin = resolveEnemyPatternOrigin(enemy, spec.patternId, direction, opts?.origin);
  if (!origin) {
    return `${enemyLabel(enemy)} attack (select pattern origin)`;
  }

  const rolled =
    opts?.damage != null
      ? { total: opts.damage, detail: String(opts.damage) }
      : parseAndRollDamage(spec.damage);
  const damage = rolled.total;
  const pullDistance = enemyAttackPullDistance(attackSpec);

  const tiles = collectEnemyPatternAttackTiles(
    state,
    enemy,
    {
      ...spec,
      damage: String(damage),
    },
    direction,
    origin,
  );
  const occ = buildBoardOccupancy(state);
  const hitPlayers = new Set<string>();
  const hitEnemies = new Set<string>();
  const parts: string[] = [];
  const effectTokens = enemyAttackNonPushEffects(attackSpec);
  const stainTiles = (attackSpec.onHit ?? []).some((h) => h.kind === "stainTiles");
  let stainedCount = 0;

  for (const tile of tiles) {
    if (stainTiles && stainMapTile(state, tile.x, tile.y)) stainedCount++;
    const key = coordKey(tile.x, tile.y);
    const player = occ.playerByKey.get(key);
    if (player && !hitPlayers.has(player.id) && (player.hp ?? 0) > 0) {
      hitPlayers.add(player.id);
      applyDamageToPlayer(player, damage, state);
      applyStacks(state, player, effectTokens, enemy, { areaAttack: true });
      maybeOfferBrandStrip(state, player);
      opts?.onPlayerHit?.(player.id);
      let part = `${playerLabel(player)} ${rolled.detail}`;
      if (pullDistance != null && pullDistance > 0) {
        const pullMsg = applyPullToward(state, player, enemy.x, enemy.y, pullDistance, {
          kind: "player",
        });
        if (pullMsg) part += `, ${pullMsg}`;
      }
      parts.push(part);
    }
    const enemies = occ.enemiesByKey.get(key) ?? [];
    for (const target of enemies) {
      if (target.id === enemy.id) continue;
      const canon = swarmGroupForEnemy(state, target.id)?.canonicalId ?? target.id;
      if (hitEnemies.has(canon)) continue;
      if ((target.hp ?? 0) <= 0) continue;
      hitEnemies.add(canon);
      const hit = state.enemies.find((e) => e.id === canon) ?? target;
      applyDamageToEnemy(hit, damage, state);
      applyStacks(state, hit, effectTokens, enemy, { areaAttack: true });
      let part = `${enemyLabel(hit)} ${rolled.detail}`;
      if (pullDistance != null && pullDistance > 0) {
        const pullMsg = applyPullToward(state, hit, enemy.x, enemy.y, pullDistance, {
          kind: "enemy",
        });
        if (pullMsg) part += `, ${pullMsg}`;
      }
      parts.push(part);
    }
  }

  const patternLabel = `${spec.patternId[0]!.toUpperCase()}${spec.patternId.slice(1)}:${spec.size}`;
  const base = `${enemyLabel(enemy)} ${patternLabel} (${rolled.detail} dmg)`;
  const stainNote = stainedCount > 0 ? `; stained ${stainedCount} tiles` : "";
  if (!parts.length) return `${base} (no targets)${stainNote}`;
  return `${base} → ${parts.join("; ")}${stainNote}`;
}

export function applySelectTargetEnemyAttack(
  state: GameState,
  enemy: Enemy,
  attackSpec: EnemyAttackSpec,
  opts: {
    targetPlayerId?: string;
    targetEnemyId?: string;
    damage?: number;
  },
): string | null {
  const pushDistance = enemyAttackPushDistance(attackSpec);
  const effectTokens = enemyAttackNonPushEffects(attackSpec);
  const baseDamage = enemyAttackDamage(attackSpec);

  let damageTotal: number | null = null;
  let damageDetail = "";
  if (baseDamage != null) {
    const rolled =
      opts.damage != null
        ? { total: opts.damage, detail: String(opts.damage) }
        : parseAndRollDamage(String(baseDamage));
    damageTotal = rolled.total;
    damageDetail = rolled.detail;
  } else if (opts.damage != null) {
    damageTotal = opts.damage;
    damageDetail = String(opts.damage);
  }

  if (opts.targetPlayerId) {
    const target = state.players.find((p) => p.id === opts.targetPlayerId);
    if (!target) return null;
    const parts: string[] = [];
    if (damageTotal != null) {
      applyDamageToPlayer(target, damageTotal, state);
      parts.push(`${damageDetail} dmg`);
    }
    applyStacks(state, target, effectTokens, enemy);
    if (pushDistance != null && pushDistance > 0) {
      const pushMsg = applyPushFromOrigin(state, target, enemy.x, enemy.y, pushDistance, {
        kind: "player",
        excludeEnemyId: enemy.id,
      });
      if (pushMsg) parts.push(pushMsg);
    }
    const suffix = parts.length ? ` for ${parts.join(", ")}` : "";
    return `${enemyLabel(enemy)} → ${playerLabel(target)}${suffix}`;
  }

  if (opts.targetEnemyId) {
    const target = state.enemies.find((e) => e.id === opts.targetEnemyId);
    if (!target) return null;
    const parts: string[] = [];
    if (damageTotal != null) {
      applyDamageToEnemy(target, damageTotal, state);
      parts.push(`${damageDetail} dmg`);
    }
    applyStacks(state, target, effectTokens, enemy);
    if (pushDistance != null && pushDistance > 0) {
      const pushMsg = applyPushFromOrigin(state, target, enemy.x, enemy.y, pushDistance, {
        kind: "enemy",
        excludeEnemyId: enemy.id,
      });
      if (pushMsg) parts.push(pushMsg);
    }
    const suffix = parts.length ? ` for ${parts.join(", ")}` : "";
    return `${enemyLabel(enemy)} → ${enemyLabel(target)}${suffix}`;
  }

  return null;
}
