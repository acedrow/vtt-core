import { tileIsStained } from "./stainwalk.js";
import { applyDamageToEnemy, applyDamageToPlayer, buildBoardOccupancy, collectEnemyPatternAttackTiles, coordKey, enemyLabel, playerLabel, resolveEnemyPatternOrigin, type Enemy, type GameState, type PatternDirection } from "@gaem/shared";

const OROBAS_LINE_SPEC = {
  patternId: "line",
  size: 4,
  damage: "3",
} as const;

export function validateOrobasStainedLine(
  state: GameState,
  enemy: Enemy,
  direction: PatternDirection | undefined,
): string | null {
  if (!direction) return "Select direction";
  const origin = resolveEnemyPatternOrigin(enemy, "line", direction, null);
  if (!origin) return "Select pattern origin";
  collectEnemyPatternAttackTiles(state, enemy, OROBAS_LINE_SPEC, direction, origin);
  return null;
}

export function applyOrobasStainedLine(
  state: GameState,
  enemy: Enemy,
  direction: PatternDirection,
): string {
  const origin = resolveEnemyPatternOrigin(enemy, "line", direction, null);
  if (!origin) return `${enemyLabel(enemy)} Line:4 (no origin)`;

  const tiles = collectEnemyPatternAttackTiles(
    state,
    enemy,
    OROBAS_LINE_SPEC,
    direction,
    origin,
  );
  const occ = buildBoardOccupancy(state);
  const hitPlayers = new Set<string>();
  const hitEnemies = new Set<string>();
  const parts: string[] = [];

  for (const tile of tiles) {
    const damage = tileIsStained(state, tile.x, tile.y) ? 8 : 3;
    const key = coordKey(tile.x, tile.y);
    const player = occ.playerByKey.get(key);
    if (player && !hitPlayers.has(player.id) && (player.hp ?? 0) > 0) {
      hitPlayers.add(player.id);
      applyDamageToPlayer(player, damage, state);
      parts.push(`${playerLabel(player)} ${damage}`);
    }
    for (const target of occ.enemiesByKey.get(key) ?? []) {
      if (target.id === enemy.id) continue;
      if (hitEnemies.has(target.id)) continue;
      if ((target.hp ?? 0) <= 0) continue;
      hitEnemies.add(target.id);
      applyDamageToEnemy(target, damage, state);
      parts.push(`${enemyLabel(target)} ${damage}`);
    }
  }

  const base = `${enemyLabel(enemy)} Line:4`;
  if (!parts.length) return `${base} (no targets)`;
  return `${base} → ${parts.join("; ")}`;
}
