import { describe, expect, it } from "vitest";

import { coordKey, tileAt } from "../map.js";
import { addTestEnemy, addTestPlayer, makeGameState } from "../test/fixtures.js";
import { validateGmEnemyAction } from "./messages.js";
import {
  enemyMovementReachability,
  findEnemyMovementPathWithCost,
  findPlayerMovementPathWithCost,
  playerMovementReachability,
} from "./movement.js";

describe("movement reachability", () => {
  it("returns budget-limited player paths around blocked and occupied tiles", () => {
    const state = makeGameState();
    const player = addTestPlayer(state, "p1", { x: 1, y: 1 });
    addTestPlayer(state, "p2", { x: 2, y: 1 });
    tileAt(state.tiles, 1, 2)!.terrain = ["impassable"];

    const reachable = playerMovementReachability(state, player.id, { budget: 2 });

    expect(reachable.has(coordKey(2, 1))).toBe(false);
    expect(reachable.has(coordKey(1, 2))).toBe(false);
    expect(reachable.get(coordKey(0, 2))).toMatchObject({ cost: 2 });
    expect(reachable.has(coordKey(3, 1))).toBe(false);
  });

  it("uses terrain cost and chooses the least-cost player path", () => {
    const state = makeGameState();
    const player = addTestPlayer(state, "p1", { x: 1, y: 1 });
    tileAt(state.tiles, 2, 1)!.terrain = ["uneasy"];
    tileAt(state.tiles, 2, 1)!.elevation = 1;
    tileAt(state.tiles, 3, 1)!.terrain = ["uneasy"];
    tileAt(state.tiles, 3, 1)!.elevation = 1;

    const result = findPlayerMovementPathWithCost(state, player.id, { x: 4, y: 1 });

    expect(result?.cost).toBe(5);
    expect(result?.path).toHaveLength(5);
    expect(result?.path).not.toContainEqual({ x: 2, y: 1 });
  });

  it("supports flying player reachability constraints", () => {
    const state = makeGameState();
    const player = addTestPlayer(state, "p1", { x: 1, y: 1 });
    tileAt(state.tiles, 2, 1)!.terrain = ["impassable"];

    expect(
      findPlayerMovementPathWithCost(state, player.id, { x: 2, y: 1 }, { budget: 1 }),
    ).toBeNull();
    expect(
      findPlayerMovementPathWithCost(state, player.id, { x: 2, y: 1 }, {
        budget: 1,
        flying: true,
        maxSteps: 1,
      }),
    ).toMatchObject({ cost: 1, path: [{ x: 2, y: 1 }] });
  });

  it("returns enemy paths that respect footprint occupancy and budget", () => {
    const state = makeGameState();
    const enemy = addTestEnemy(state, "e1", 1, 1, { scale: 2 });
    addTestEnemy(state, "blocker", 3, 1);

    const reachable = enemyMovementReachability(state, enemy.id, { budget: 2 });

    expect(reachable.has(coordKey(2, 1))).toBe(false);
    expect(reachable.get(coordKey(1, 3))).toMatchObject({ cost: 2 });
    expect(reachable.has(coordKey(1, 4))).toBe(false);
  });

  it("uses swarm movement costing when requested", () => {
    const state = makeGameState();
    const enemy = addTestEnemy(state, "e1", 1, 1);
    tileAt(state.tiles, 2, 1)!.elevation = 2;

    expect(
      findEnemyMovementPathWithCost(state, enemy.id, { x: 2, y: 1 }, { budget: 1 }),
    ).toBeNull();
    expect(
      findEnemyMovementPathWithCost(state, enemy.id, { x: 2, y: 1 }, {
        budget: 1,
        swarm: true,
      }),
    ).toMatchObject({ cost: 1 });
  });

  it("validates GM enemy paths from each preceding step", () => {
    const state = makeGameState({ roundPhase: "gmTurn" });
    const enemy = addTestEnemy(state, "e1", 1, 1);
    enemy.movementRemaining = 2;

    expect(
      validateGmEnemyAction(state, {
        action: "move",
        enemyId: enemy.id,
        path: [{ x: 2, y: 1 }, { x: 3, y: 1 }],
      }),
    ).toBeNull();
    expect(
      validateGmEnemyAction(state, {
        action: "move",
        enemyId: enemy.id,
        path: [{ x: 2, y: 1 }, { x: 3, y: 1 }, { x: 4, y: 1 }],
      }),
    ).toBe("Not enough movement");
  });
});
