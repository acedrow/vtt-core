import { describe, expect, it } from "vitest";
import {
  agnosiaBoxTiles,
  agnosiaCenteredHover,
  agnosiaPlacementBoxTiles,
  getAgnosiaHp,
  maybeTriggerAgnosia,
} from "@gaem/shared";
import { applyDamageToEnemy } from "@gaem/shared";
import { createDefaultCombatState } from "@gaem/shared";
import { tileAt } from "@gaem/shared";
import {
  applyGorgenautAgnosia,
  validateConfirmGorgenautAgnosia,
} from "../../combat/gorgenaut.js";
import { addTestEnemy, addTestPlayer, makeGameState } from "../fixtures.js";

describe("agnosia", () => {
  it("resolves agnosiaHp from listing", () => {
    expect(getAgnosiaHp({ name: "Gorgenaut" })).toBe(20);
    expect(getAgnosiaHp({ name: "RETIARIUS" })).toBe(20);
    expect(getAgnosiaHp({ name: "Stain Creep" })).toBeNull();
  });

  it("computes 5x5 box for scale 2 with offset 1", () => {
    const tiles = agnosiaBoxTiles(3, 3, 2, 5, 10, 10);
    expect(tiles).toHaveLength(25);
    expect(tiles.some((t) => t.x === 2 && t.y === 2)).toBe(true);
    expect(tiles.some((t) => t.x === 6 && t.y === 6)).toBe(true);
    expect(tiles.some((t) => t.x === 1 && t.y === 1)).toBe(false);
  });

  it("placement box keeps footprint inside and follows hover top-left", () => {
    const centered = agnosiaCenteredHover(3, 3, 2, 5);
    expect(centered).toEqual({ x: 2, y: 2 });
    const defaultTiles = agnosiaPlacementBoxTiles(3, 3, 2, centered.x, centered.y, 5, 10, 10);
    expect(defaultTiles).toHaveLength(25);
    expect(defaultTiles.some((t) => t.x === 3 && t.y === 3)).toBe(true);
    expect(defaultTiles.some((t) => t.x === 4 && t.y === 4)).toBe(true);

    const shifted = agnosiaPlacementBoxTiles(3, 3, 2, 0, 0, 5, 10, 10);
    expect(shifted.some((t) => t.x === 0 && t.y === 0)).toBe(true);
    expect(shifted.some((t) => t.x === 3 && t.y === 3)).toBe(true);
    expect(shifted.some((t) => t.x === 4 && t.y === 4)).toBe(true);
    expect(shifted.some((t) => t.x === 5 && t.y === 5)).toBe(false);
  });

  it("queues pending for Gorgenaut without auto-staining", () => {
    const state = makeGameState({ combat: createDefaultCombatState(1) });
    const enemy = addTestEnemy(state, "g", 3, 3, { name: "Gorgenaut", scale: 2, hp: 25 });
    applyDamageToEnemy(enemy, 30, state);
    expect(enemy.hp).toBe(0);
    expect(enemy.agnosiaTriggered).toBe(true);
    expect(tileAt(state.tiles, 2, 2)?.tileEffects?.Stained).toBeUndefined();
    expect(state.combat!.pendingActions.some((p) => p.label.includes("Agnosia"))).toBe(true);

    applyDamageToEnemy(enemy, 1, state);
    expect(state.combat!.pendingActions.filter((p) => p.label.includes("Agnosia"))).toHaveLength(1);
  });

  it("does not double-trigger", () => {
    const state = makeGameState({ combat: createDefaultCombatState(1) });
    const enemy = addTestEnemy(state, "g", 3, 3, { name: "Gorgenaut", scale: 2, hp: 25 });
    enemy.agnosiaTriggered = true;
    expect(maybeTriggerAgnosia(state, enemy, 25)).toEqual([]);
    expect(tileAt(state.tiles, 2, 2)?.tileEffects?.Stained).toBeUndefined();
  });

  it("queues pending for enemies without a handler", () => {
    const state = makeGameState({ combat: createDefaultCombatState(1) });
    const enemy = addTestEnemy(state, "o", 2, 2, { name: "OROBAS", scale: 3, hp: 55 });
    applyDamageToEnemy(enemy, 10, state);
    expect(enemy.hp).toBe(45);
    expect(enemy.agnosiaTriggered).toBe(true);
    expect(state.combat!.pendingActions.some((p) => p.kind === "enemySpecial")).toBe(true);
  });

  it("applyGorgenautAgnosia stains with overlay and pulls players", () => {
    const state = makeGameState({ combat: createDefaultCombatState(1) });
    const enemy = addTestEnemy(state, "g", 3, 3, { name: "Gorgenaut", scale: 2, hp: 21 });
    const player = addTestPlayer(state, "p1", { x: 2, y: 2, hp: 20, class: "HARPE" });
    applyDamageToEnemy(enemy, 5, state);
    expect(enemy.agnosiaTriggered).toBe(true);
    expect(validateConfirmGorgenautAgnosia(state, enemy.id, 2, 2)).toBeNull();

    const result = applyGorgenautAgnosia(state, enemy, 2, 2);
    expect(result.coords).toHaveLength(25);
    expect(tileAt(state.tiles, 2, 2)?.tileEffects?.Stained).toBe(1);
    expect(tileAt(state.tiles, 2, 2)?.overlayKey).toMatch(/^tiles\/overlays\/stain\/stain\/\d+\.png$/);
    expect(tileAt(state.tiles, 6, 6)?.tileEffects?.Stained).toBe(1);
    expect(player.x).toBe(3);
    expect(player.y).toBe(2);
    expect(state.combat!.pendingActions.filter((p) => p.label.includes("Agnosia"))).toHaveLength(0);
    expect(result.message).toContain("stained");
  });
});
