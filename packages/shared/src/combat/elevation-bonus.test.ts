import { describe, expect, it } from "vitest";
import { tileAt } from "../map.js";
import { addTestEnemy, addTestPlayer, makeGameState } from "../test/fixtures.js";
import {
  applyAttackToEnemies,
  collectAttackTiles,
  elevationBonusTileCandidates,
} from "./attack.js";
import type { WeaponAttackSpec } from "./types.js";

describe("elevation bonus pattern tile", () => {
  it("keeps elevation bonus when attacker unit elevation exceeds tile elevation", () => {
    const state = makeGameState();
    const attacker = addTestPlayer(state, "p1", { x: 2, y: 2 });
    attacker.elevation = 2;
    tileAt(state.tiles, 2, 2)!.elevation = 0;
    addTestEnemy(state, "e1", 3, 2, { hp: 20 });
    const bonusEnemy = addTestEnemy(state, "e2", 3, 1, { hp: 20 });
    tileAt(state.tiles, 3, 2)!.elevation = 0;
    tileAt(state.tiles, 3, 1)!.elevation = 0;

    const spec: WeaponAttackSpec = {
      tiles: [[1, 0]],
      damage: "5",
    };
    const origin = { x: 2, y: 2 };
    const baseTiles = collectAttackTiles(state, origin, spec, "e");
    const candidates = elevationBonusTileCandidates(state, origin, baseTiles, attacker);
    expect(candidates.some((t) => t.x === 3 && t.y === 1)).toBe(true);

    const withBonus = collectAttackTiles(state, origin, spec, "e", { x: 3, y: 1 });
    expect(withBonus.some((t) => t.x === 3 && t.y === 1)).toBe(true);

    applyAttackToEnemies(state, spec, origin, "e", 5, {
      elevationBonusTile: { x: 3, y: 1 },
      attacker,
    });
    expect(bonusEnemy.hp).toBeLessThan(20);
  });
});
