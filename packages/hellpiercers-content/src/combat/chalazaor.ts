import type { Enemy, GameState } from "@gaem/shared";
import { enemyLabel } from "@gaem/shared";
import { getEnemyListingByName } from "@gaem/shared";
import { addEnemy, validateEnemyFootprint } from "@gaem/shared";
import { isInBounds } from "@gaem/shared";
import { isOrthogonallyAdjacent } from "@gaem/shared";
import {
  resolveCountdownExpiry,
  setCountdownKind,
  trackCountdownKinds,
} from "@gaem/shared";
import { applyEffectStacks, applyEnemyEffectStacks } from "@gaem/shared";

export function isSoaringBombardier(enemy: Pick<Enemy, "name">): boolean {
  const listing = getEnemyListingByName(enemy.name);
  if (!listing) {
    const name = enemy.name?.toUpperCase() ?? "";
    return name.includes("CHALAZAOR") || name.includes("SOARING BOMBARDIER");
  }
  return listing.name === "Soaring Bombardier" || listing.codename === "CHALAZAOR";
}

export function flowerbudPlantTiles(state: GameState, enemy: Enemy): { x: number; y: number }[] {
  const tiles: { x: number; y: number }[] = [];
  for (const [dx, dy] of [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ] as const) {
    const x = enemy.x + dx;
    const y = enemy.y + dy;
    if (!isInBounds(x, y, state.width, state.height)) continue;
    if (validateEnemyFootprint(state, x, y, 1, undefined, undefined, { name: "Flowerbud" }) !== null) {
      continue;
    }
    tiles.push({ x, y });
  }
  return tiles;
}

export function validateFlowerbudPlant(
  state: GameState,
  enemy: Enemy,
  opts: { destX?: number; destY?: number },
): string | null {
  if (opts.destX == null || opts.destY == null) return "Select adjacent square";
  const { destX, destY } = opts;
  if (!isOrthogonallyAdjacent(enemy, { x: destX, y: destY })) return "Destination must be adjacent";
  const err = validateEnemyFootprint(state, destX, destY, 1, undefined, undefined, {
    name: "Flowerbud",
  });
  if (err) return err;
  return null;
}

export function applyFlowerbudPlant(
  state: GameState,
  enemy: Enemy,
  destX: number,
  destY: number,
): string {
  const id = `flowerbud-${destX}-${destY}-${Date.now()}`;
  const err = addEnemy(state, {
    id,
    name: "Flowerbud",
    x: destX,
    y: destY,
    scale: 1,
    hp: 1,
    speed: 0,
  });
  if (err) return `${enemyLabel(enemy)} Flowerbud plant failed: ${err}`;
  const bud = state.enemies.find((e) => e.id === id);
  if (!bud) return `${enemyLabel(enemy)} Flowerbud plant failed`;
  applyEffectStacks(bud, ["Countdown:2"]);
  trackCountdownKinds(state, bud, ["Countdown:2"]);
  setCountdownKind(state, bud.id, "flowerbud");
  return `${enemyLabel(enemy)} planted Flowerbud at (${destX}, ${destY})`;
}

export function applyChalazaorAgnosia(state: GameState, enemy: Enemy): string[] {
  applyEnemyEffectStacks(state, enemy, ["Countdown:10"]);
  trackCountdownKinds(state, enemy, ["Countdown:10"]);
  setCountdownKind(state, enemy.id, "chazaor_agnosia");
  return [`${enemyLabel(enemy)} Agnosia: Countdown:10`];
}

export function tryChalazaorDamageNegation(
  state: GameState,
  enemy: Enemy,
): { negated: true; dealt: 0 } | null {
  if (!isSoaringBombardier(enemy)) return null;
  if (!enemy.agnosiaTriggered) return null;
  const countdown = enemy.effects?.Countdown ?? 0;
  if (countdown <= 0) return null;

  const next = countdown - 1;
  if (next <= 0) {
    delete enemy.effects!.Countdown;
    if (enemy.effects && Object.keys(enemy.effects).length === 0) delete enemy.effects;
    const msgs = resolveCountdownExpiry({ state, unit: enemy, kind: "chazaor_agnosia" });
    if (state.combat) {
      if (!state.combat.sideEffectMessages) state.combat.sideEffectMessages = [];
      state.combat.sideEffectMessages.push(
        `${enemyLabel(enemy)} negated damage (Countdown → 0)`,
        ...msgs,
      );
    }
  } else {
    enemy.effects!.Countdown = next;
    if (state.combat) {
      if (!state.combat.sideEffectMessages) state.combat.sideEffectMessages = [];
      state.combat.sideEffectMessages.push(
        `${enemyLabel(enemy)} negated damage (Countdown:${next})`,
      );
    }
  }
  return { negated: true, dealt: 0 };
}
