import { attackTargetsSwarm, swarmMembersHitByTiles } from "../../combat/swarm.js";
import { describe, expect, it } from "vitest";

import { applyAttackToEnemies, enemiesInTiles } from "@gaem/shared";
import { addTestEnemy, makeGameState } from "../fixtures.js";
import type { WeaponAttackSpec } from "@gaem/shared";

describe("stacked enemy AOE", () => {
  it("enemiesInTiles returns every enemy sharing a covered tile", () => {
    const state = makeGameState();
    addTestEnemy(state, "e1", 4, 4, { name: "Gorgenaut", hp: 10 });
    addTestEnemy(state, "e2", 4, 4, { name: "Gorgenaut", hp: 10 });
    addTestEnemy(state, "e3", 5, 4, { name: "Gorgenaut", hp: 10 });

    const targets = enemiesInTiles(state, [{ x: 4, y: 4 }]);
    expect(targets.map((t) => t.enemyId).sort()).toEqual(["e1", "e2"]);
  });

  it("applyAttackToEnemies damages every stacked enemy on a pattern tile", () => {
    const state = makeGameState();
    addTestEnemy(state, "e1", 3, 2, { name: "Gorgenaut", hp: 10 });
    addTestEnemy(state, "e2", 3, 2, { name: "Gorgenaut", hp: 10 });
    addTestEnemy(state, "miss", 5, 5, { name: "Gorgenaut", hp: 10 });

    const spec: WeaponAttackSpec = {
      damage: "3",
      tiles: [[1, 0]],
    };
    const result = applyAttackToEnemies(state, spec, { x: 2, y: 2 }, "e", 3);
    expect(result.targets.map((t) => t.enemyId).sort()).toEqual(["e1", "e2"]);
    expect(state.enemies.find((e) => e.id === "e1")!.hp).toBe(7);
    expect(state.enemies.find((e) => e.id === "e2")!.hp).toBe(7);
    expect(state.enemies.find((e) => e.id === "miss")!.hp).toBe(10);
  });

  it("detects a swarm member stacked under a non-swarm enemy", () => {
    const state = makeGameState();
    addTestEnemy(state, "pudding", 4, 4, { name: "Latent Pudding", hp: 1 });
    addTestEnemy(state, "eye", 4, 4, { name: "Scorned Eyes", hp: 1 });
    addTestEnemy(state, "eye2", 5, 4, { name: "Scorned Eyes", hp: 1 });

    const tiles = [{ x: 4, y: 4 }];
    expect(attackTargetsSwarm(state, tiles)).toBe(true);
    expect(swarmMembersHitByTiles(state, tiles).map((h) => h.enemyId)).toEqual(["eye"]);

    const targets = enemiesInTiles(state, tiles);
    expect(targets.map((t) => t.enemyId).sort()).toEqual(["eye", "pudding"]);
  });
});
