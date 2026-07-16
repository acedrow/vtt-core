import type { Enemy, GameState, Player } from "@gaem/shared";
import {
  agnosiaPlacementBoxTiles,
  applyPullToward,
  buildBoardOccupancy,
  coordKey,
  enemyLabel,
  findAgnosiaPending,
  getEnemyAttack,
  getEnemyScale,
  isInBounds,
  playerLabel,
  applyGmForceMove,
  validateGmForceMove,
  applyDamageToEnemy,
  applyDamageToPlayer,
  enemyDirectAttackTargetEnemyIds,
  enemyDirectAttackTargetPlayerIds,
  enemyPatternOrigins,
  applyPatternEnemyAttack,
  type EnemyAttackSpec,
  type PatternDirection,
  type PendingConfirmHandler,
} from "@gaem/shared";
import { stainMapTile, stainwalkKind, tileIsStained } from "./stainwalk.js";

export const GORGENAUT_AGNOSIA_BOX = 5;
export const GORGENAUT_AGNOSIA_CONFIRM_KIND = "gorgenaut-agnosia";

export function isGorgenaut(enemy: Pick<Enemy, "name">): boolean {
  return stainwalkKind(enemy) === "gorgenaut";
}

export function isGorgenautEnemy(enemy: Pick<Enemy, "name">): boolean {
  return isGorgenaut(enemy);
}

export function findGorgenautAgnosiaPending(state: GameState, enemyId: string) {
  return findAgnosiaPending(state, enemyId);
}

export function applyGorgenautAgnosia(
  state: GameState,
  enemy: Enemy,
  hoverX: number,
  hoverY: number,
): { message: string; coords: { x: number; y: number }[] } {
  const scale = getEnemyScale(enemy);
  const tiles = agnosiaPlacementBoxTiles(
    enemy.x,
    enemy.y,
    scale,
    hoverX,
    hoverY,
    GORGENAUT_AGNOSIA_BOX,
    state.width,
    state.height,
  );
  let stained = 0;
  for (const t of tiles) {
    if (stainMapTile(state, t.x, t.y)) stained++;
  }

  const boxKeys = new Set(tiles.map((t) => coordKey(t.x, t.y)));
  const occ = buildBoardOccupancy(state);
  const messages: string[] = [`${enemyLabel(enemy)} Agnosia: stained ${stained} tiles`];
  const pulled = new Set<string>();
  for (const key of boxKeys) {
    const player = occ.playerByKey.get(key);
    if (!player || pulled.has(player.id)) continue;
    if ((player.hp ?? 0) <= 0) continue;
    pulled.add(player.id);
    const pullMsg = applyPullToward(state, player, enemy.x, enemy.y, 1, { kind: "player" });
    if (pullMsg) messages.push(pullMsg);
  }

  const pending = findGorgenautAgnosiaPending(state, enemy.id);
  if (pending && state.combat) {
    state.combat.pendingActions = state.combat.pendingActions.filter((p) => p.id !== pending.id);
  }

  return { message: messages.join("; "), coords: tiles };
}

export function validateConfirmGorgenautAgnosia(
  state: GameState,
  enemyId: string,
  hoverX: number,
  hoverY: number,
): string | null {
  if (!Number.isInteger(hoverX) || !Number.isInteger(hoverY)) return "Invalid hover coordinates";
  if (!isInBounds(hoverX, hoverY, state.width, state.height)) return "Hover out of bounds";
  const enemy = state.enemies.find((e) => e.id === enemyId);
  if (!enemy) return "Enemy not found";
  if (!isGorgenautEnemy(enemy)) return "Not a Gorgenaut";
  if (!findGorgenautAgnosiaPending(state, enemyId)) return "No pending Gorgenaut Agnosia";
  return null;
}

export const gorgenautAgnosiaConfirmHandler: PendingConfirmHandler = {
  validate: ({ state, enemyId, hoverX, hoverY }) =>
    validateConfirmGorgenautAgnosia(state, enemyId, hoverX, hoverY),
  apply: ({ state, enemyId, hoverX, hoverY }) => {
    const enemy = state.enemies.find((e) => e.id === enemyId)!;
    return applyGorgenautAgnosia(state, enemy, hoverX, hoverY);
  },
};

const GORGENAUT_CONE_SPEC: EnemyAttackSpec = {
  targeting: "pattern",
  patternId: "cone",
  size: 3,
  damage: "5",
  effects: ["Pull:1"],
};

const STAIN_TELEPORT_SPEC: EnemyAttackSpec = {
  targeting: "select",
  damage: "10",
  adjacent: true,
  specialId: "stain-teleport",
};

export function applyGorgenautConeAttack(
  state: GameState,
  enemy: Enemy,
  direction: PatternDirection,
  damage: number,
): string {
  const spec = getEnemyAttack(enemy.name, 0)?.attack ?? GORGENAUT_CONE_SPEC;
  const origins = enemyPatternOrigins(enemy, direction, spec.patternId ?? "cone");
  return applyPatternEnemyAttack(state, enemy, spec, direction, {
    damage,
    origin: origins[0],
  });
}

export function validateGorgenautStainTeleport(
  state: GameState,
  enemy: Enemy,
  opts: {
    targetPlayerId?: string;
    targetEnemyId?: string;
    destX?: number;
    destY?: number;
  },
  attackSpec?: EnemyAttackSpec,
): string | null {
  const spec = attackSpec ?? STAIN_TELEPORT_SPEC;
  if (opts.targetPlayerId) {
    const valid = enemyDirectAttackTargetPlayerIds(state, enemy.id, spec);
    if (!valid.includes(opts.targetPlayerId)) return "Target out of range";
  } else if (opts.targetEnemyId) {
    const valid = enemyDirectAttackTargetEnemyIds(state, enemy.id, spec);
    if (!valid.includes(opts.targetEnemyId)) return "Target out of range";
  } else {
    return "Select target";
  }
  if (opts.destX == null || opts.destY == null) return "Select stained destination";
  if (!tileIsStained(state, opts.destX, opts.destY)) return "Destination must be stained";

  if (opts.targetPlayerId) {
    return validateGmForceMove(
      state,
      { kind: "player", id: opts.targetPlayerId },
      opts.destX,
      opts.destY,
    );
  }
  return validateGmForceMove(
    state,
    { kind: "enemy", id: opts.targetEnemyId! },
    opts.destX,
    opts.destY,
  );
}

export function applyGorgenautStainTeleport(
  state: GameState,
  enemy: Enemy,
  opts: {
    targetPlayerId?: string;
    targetEnemyId?: string;
    destX: number;
    destY: number;
    damage: number;
  },
): string {
  if (opts.targetPlayerId) {
    const target = state.players.find((p) => p.id === opts.targetPlayerId) as Player;
    applyDamageToPlayer(target, opts.damage, state);
    applyGmForceMove(state, { kind: "player", id: target.id }, opts.destX, opts.destY);
    return `${enemyLabel(enemy)} → ${playerLabel(target)} for ${opts.damage}, moved to (${opts.destX}, ${opts.destY})`;
  }
  const target = state.enemies.find((e) => e.id === opts.targetEnemyId)!;
  applyDamageToEnemy(target, opts.damage, state);
  applyGmForceMove(state, { kind: "enemy", id: target.id }, opts.destX, opts.destY);
  return `${enemyLabel(enemy)} → ${enemyLabel(target)} for ${opts.damage}, moved to (${opts.destX}, ${opts.destY})`;
}
