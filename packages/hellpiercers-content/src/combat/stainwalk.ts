import type { Enemy, GameState } from "@gaem/shared";
import { enemyLabel } from "@gaem/shared";
import {
  getEnemyListingByName,
  getEnemyScale,
  enemyFootprintTiles,
  refreshEnemyMovement,
} from "@gaem/shared";
import { clampHp, getEnemyMaxHp, isSandboxMode } from "@gaem/shared";
import { coordKey, tileAt } from "@gaem/shared";
import { setTileEffect } from "@gaem/shared";
import { STAIN_GEYSER_OVERLAY_GROUP_KEY } from "./stain-geyser.js";

export type StainwalkKind =
  | "orobas"
  | "eyesting-rose"
  | "gorgenaut"
  | "lurking-freak"
  | "stain-creep";

const STAINWALK_BY_NAME: Record<string, StainwalkKind> = {
  orobas: "orobas",
  "eyesting rose": "eyesting-rose",
  gorgenaut: "gorgenaut",
  "lurking freak": "lurking-freak",
  "stain creep": "stain-creep",
};

const STAIN_OVERLAY_MEMBER_COUNT = 16;

export function stainwalkKind(enemy: Pick<Enemy, "name">): StainwalkKind | null {
  const listing = getEnemyListingByName(enemy.name);
  if (!listing) return null;
  return STAINWALK_BY_NAME[listing.name.trim().toLowerCase()] ?? null;
}

export function stainOverlayKeyForTile(x: number, y: number): string {
  const n = 1 + ((x * 17 + y * 31) % STAIN_OVERLAY_MEMBER_COUNT);
  return `${STAIN_GEYSER_OVERLAY_GROUP_KEY}/${n}.png`;
}

export function stainMapTile(state: GameState, x: number, y: number): boolean {
  const mapTile = tileAt(state.tiles, x, y);
  if (!mapTile) return false;
  setTileEffect(mapTile, "Stained:1");
  mapTile.overlayKey = stainOverlayKeyForTile(x, y);
  return true;
}

export function tileIsStained(state: GameState, x: number, y: number): boolean {
  if ((tileAt(state.tiles, x, y)?.tileEffects?.Stained ?? 0) > 0) return true;
  for (const enemy of state.enemies) {
    if (!enemy.burrowed || (enemy.hp ?? 0) <= 0) continue;
    if (stainwalkKind(enemy) !== "lurking-freak") continue;
    for (const tile of enemyFootprintTiles(enemy.x, enemy.y, getEnemyScale(enemy))) {
      if (tile.x === x && tile.y === y) return true;
    }
  }
  return false;
}

export function enemyOnStainedTile(state: GameState, enemy: Pick<Enemy, "x" | "y" | "scale" | "name">): boolean {
  const scale = getEnemyScale(enemy);
  for (const tile of enemyFootprintTiles(enemy.x, enemy.y, scale)) {
    if (tileIsStained(state, tile.x, tile.y)) return true;
  }
  return false;
}

export function applyStainwalkMovement(state: GameState, enemy: Enemy): void {
  refreshEnemyMovement(enemy);
  if (stainwalkKind(enemy) === "orobas" && enemyOnStainedTile(state, enemy)) {
    enemy.movementRemaining = (enemy.movementRemaining ?? 0) * 2;
  }
}

export function applyStainwalkGmTurnEnd(state: GameState): string[] {
  const messages: string[] = [];
  if (isSandboxMode(state)) return messages;

  for (const enemy of state.enemies) {
    const kind = stainwalkKind(enemy);
    if (!kind) continue;
    const maxHp = getEnemyMaxHp(enemy);
    const hp = enemy.hp ?? maxHp;
    if (hp <= 0) continue;

    if (kind === "gorgenaut" && enemyOnStainedTile(state, enemy)) {
      const before = hp;
      enemy.hp = clampHp(before + 10, maxHp);
      const healed = (enemy.hp ?? 0) - before;
      if (healed > 0) {
        messages.push(`${enemyLabel(enemy)} recovered ${healed} HP (Stainwalk)`);
      }
    } else if (kind === "lurking-freak" && !enemyOnStainedTile(state, enemy)) {
      enemy.hp = clampHp(hp - 10, maxHp);
      messages.push(`${enemyLabel(enemy)} took 10 damage (Stainwalk)`);
    }
  }
  return messages;
}

function stainedTilesConnected(
  state: GameState,
  a: { x: number; y: number },
  b: { x: number; y: number },
): boolean {
  if (!tileIsStained(state, a.x, a.y) || !tileIsStained(state, b.x, b.y)) return false;
  if (a.x === b.x && a.y === b.y) return true;

  const start = coordKey(a.x, a.y);
  const goal = coordKey(b.x, b.y);
  const visited = new Set<string>([start]);
  const queue = [{ x: a.x, y: a.y }];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const [dx, dy] of [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ] as const) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      const key = coordKey(nx, ny);
      if (visited.has(key) || !tileIsStained(state, nx, ny)) continue;
      if (key === goal) return true;
      visited.add(key);
      queue.push({ x: nx, y: ny });
    }
  }
  return false;
}

function enemyStainedFootprint(
  state: GameState,
  enemy: Pick<Enemy, "x" | "y" | "scale" | "name">,
): { x: number; y: number }[] {
  return enemyFootprintTiles(enemy.x, enemy.y, getEnemyScale(enemy)).filter((t) =>
    tileIsStained(state, t.x, t.y),
  );
}

export function stainwalkDamageAdjustment(state: GameState, target: Enemy): number {
  const rose = state.enemies.find(
    (e) =>
      stainwalkKind(e) === "eyesting-rose" &&
      (e.hp ?? getEnemyMaxHp(e)) > 0 &&
      enemyOnStainedTile(state, e),
  );
  if (!rose) return 0;

  if (target.id === rose.id) return 2;

  const roseTiles = enemyStainedFootprint(state, rose);
  const targetTiles = enemyStainedFootprint(state, target);
  if (!roseTiles.length || !targetTiles.length) return 0;

  for (const a of roseTiles) {
    for (const b of targetTiles) {
      if (stainedTilesConnected(state, a, b)) return -2;
    }
  }
  return 0;
}
