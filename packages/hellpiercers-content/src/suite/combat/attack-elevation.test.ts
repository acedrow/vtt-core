import { describe, expect, it } from "vitest";
import {
  collectAttackTiles,
  effectiveRangeLimit,
  elevationBonusTileCandidates,
  elevationRangeBonus,
} from "@gaem/shared";
import { addTestEnemy, addTestPlayer, makeGameState } from "../fixtures.js";
import { tileAt } from "@gaem/shared";
import type { WeaponAttackSpec } from "@gaem/shared";

describe("elevationRangeBonus", () => {
  it("adds attacker elevation when target is lower", () => {
    expect(elevationRangeBonus(2, 0)).toBe(2);
    expect(elevationRangeBonus(1, 1)).toBe(0);
  });
});

describe("effectiveRangeLimit", () => {
  it("extends range when shooting down from elevation", () => {
    const state = makeGameState();
    addTestPlayer(state, "p1", { x: 2, y: 2, class: "HARPE" });
    const originTile = tileAt(state.tiles, 2, 2)!;
    originTile.elevation = 2;
    const targetTile = tileAt(state.tiles, 5, 2)!;
    targetTile.elevation = 0;
    expect(effectiveRangeLimit(state, { x: 2, y: 2 }, 3, { x: 5, y: 2 })).toBe(5);
  });
});

describe("elevation bonus pattern tile", () => {
  it("adds orthogonally adjacent lower tile when hitting lower enemy", () => {
    const state = makeGameState();
    addTestPlayer(state, "p1", { x: 2, y: 2, class: "HARPE" });
    addTestEnemy(state, "e1", 3, 2, { hp: 5 });
    tileAt(state.tiles, 2, 2)!.elevation = 2;
    tileAt(state.tiles, 3, 2)!.elevation = 0;
    tileAt(state.tiles, 3, 1)!.elevation = 0;

    const spec: WeaponAttackSpec = {
      tiles: [[1, 0]],
      damage: "3",
    };
    const baseTiles = collectAttackTiles(state, { x: 2, y: 2 }, spec, "e");
    expect(baseTiles.some((t) => t.x === 3 && t.y === 2)).toBe(true);
    const candidates = elevationBonusTileCandidates(state, { x: 2, y: 2 }, baseTiles);
    expect(candidates.some((t) => t.x === 3 && t.y === 1)).toBe(true);

    const withBonus = collectAttackTiles(state, { x: 2, y: 2 }, spec, "e", { x: 3, y: 1 });
    expect(withBonus.some((t) => t.x === 3 && t.y === 1)).toBe(true);
    expect(withBonus.length).toBe(baseTiles.length + 1);
  });

  it("uses hit swarm segment elevation, not canonical anchor elevation", () => {
    const state = makeGameState();
    const attacker = addTestPlayer(state, "p1", { x: 2, y: 2, class: "HARPE" });
    attacker.elevation = 2;
    tileAt(state.tiles, 2, 2)!.elevation = 2;
    // Canonical id sorts first ("a"); high elev. Segment "b" is the hit tile at elev 0.
    addTestEnemy(state, "a", 3, 2, { name: "Scorned Eyes", hp: 20 });
    addTestEnemy(state, "b", 4, 2, { name: "Scorned Eyes", hp: 20 });
    tileAt(state.tiles, 3, 2)!.elevation = 2;
    tileAt(state.tiles, 4, 2)!.elevation = 0;
    tileAt(state.tiles, 4, 1)!.elevation = 0;

    const spec: WeaponAttackSpec = {
      tiles: [[2, 0]],
      damage: "3",
    };
    const baseTiles = collectAttackTiles(state, { x: 2, y: 2 }, spec, "e");
    expect(baseTiles.some((t) => t.x === 4 && t.y === 2)).toBe(true);
    const candidates = elevationBonusTileCandidates(state, { x: 2, y: 2 }, baseTiles, attacker);
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.some((t) => t.x === 4 && t.y === 1)).toBe(true);
  });
});
