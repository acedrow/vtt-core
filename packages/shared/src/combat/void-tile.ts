import type { Enemy, GameState, Player } from "../types.js";
import { enemyLabel, playerLabel } from "../console.js";
import { tileAt } from "../map.js";
import { enemyFootprintTiles, getEnemyScale } from "../enemy-data.js";

export function isVoidTile(state: GameState, x: number, y: number): boolean {
  const tile = tileAt(state.tiles, x, y);
  return !!tile?.terrain.includes("void");
}

export function enemyFullyOnVoid(state: GameState, enemy: Enemy): boolean {
  const scale = getEnemyScale(enemy);
  const footprint = enemyFootprintTiles(enemy.x, enemy.y, scale);
  return footprint.length > 0 && footprint.every((t) => isVoidTile(state, t.x, t.y));
}

export function applyVoidTileDefeat(
  state: GameState,
  unit: Player | Enemy,
  kind: "player" | "enemy",
): string | null {
  if (kind === "player") {
    const player = unit as Player;
    if ((player.hp ?? 0) <= 0) return null;
    if (!isVoidTile(state, player.x, player.y)) return null;
    player.hp = 0;
    return `${playerLabel(player)} fell into the Void`;
  }
  const enemy = unit as Enemy;
  if ((enemy.hp ?? 0) <= 0) return null;
  if (!enemyFullyOnVoid(state, enemy)) return null;
  enemy.hp = 0;
  return `${enemyLabel(enemy)} fell into the Void`;
}
