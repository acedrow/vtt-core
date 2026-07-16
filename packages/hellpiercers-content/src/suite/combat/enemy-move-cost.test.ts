import { applySwarmMove, getSwarmMovementRemaining, reconcileSwarmMovement, validateSwarmMove } from "../../combat/swarm.js";
import { describe, expect, it } from "vitest";
import { applyEnemyMove, validateEnemyMove } from "@gaem/shared";
import { tileAt } from "@gaem/shared";
import { addTestEnemy, makeGameState } from "../fixtures.js";
import { enemyMoveStepCost } from "@gaem/shared";

const SWARM_NAME = "Scorned Eyes";
const FLYING_SWARM = "Shadowing Witness";
const FLYING_ENEMY = "Soaring Bombardier";
const GROUND_ENEMY = "Stain Creep";

describe("enemyMoveStepCost", () => {
  it("charges +1 for Uneasy", () => {
    const state = makeGameState();
    tileAt(state.tiles, 3, 2)!.terrain = ["uneasy"];
    const enemy = addTestEnemy(state, "e1", 2, 2, { name: GROUND_ENEMY });
    expect(enemyMoveStepCost(state, enemy, 2, 2, 3, 2)).toBe(2);
  });

  it("charges +1 uphill; Seeking keeps 1", () => {
    const state = makeGameState();
    tileAt(state.tiles, 3, 2)!.elevation = 2;
    const enemy = addTestEnemy(state, "e1", 2, 2, { name: GROUND_ENEMY });
    expect(enemyMoveStepCost(state, enemy, 2, 2, 3, 2)).toBe(2);
    enemy.effects = { Seeking: 1 };
    expect(enemyMoveStepCost(state, enemy, 2, 2, 3, 2)).toBe(1);
  });

  it("swarm ignoreElevation skips uphill but still pays Uneasy", () => {
    const state = makeGameState();
    tileAt(state.tiles, 3, 2)!.elevation = 2;
    tileAt(state.tiles, 3, 2)!.terrain = ["uneasy"];
    const enemy = addTestEnemy(state, "e1", 2, 2, { name: SWARM_NAME });
    expect(enemyMoveStepCost(state, enemy, 2, 2, 3, 2, { swarm: true })).toBe(2);
    tileAt(state.tiles, 4, 2)!.elevation = 2;
    tileAt(state.tiles, 4, 2)!.terrain = ["standard"];
    expect(enemyMoveStepCost(state, enemy, 2, 2, 4, 2, { swarm: true })).toBe(1);
  });

  it("Flying skips Uneasy", () => {
    const state = makeGameState();
    tileAt(state.tiles, 3, 2)!.terrain = ["uneasy"];
    const enemy = addTestEnemy(state, "e1", 2, 2, { name: FLYING_ENEMY });
    expect(enemyMoveStepCost(state, enemy, 2, 2, 3, 2)).toBe(1);
  });

  it("Slow doubles cost", () => {
    const state = makeGameState();
    const enemy = addTestEnemy(state, "e1", 2, 2, {
      name: GROUND_ENEMY,
      effects: { Slow: 1 },
    });
    expect(enemyMoveStepCost(state, enemy, 2, 2, 3, 2)).toBe(2);
  });
});

describe("enemy/swarm movement spend", () => {
  it("non-swarm enemy spends 2 entering Uneasy; rejects with 1 remaining", () => {
    const state = makeGameState({ roundPhase: "gmTurn", turn: { role: "gm" } });
    tileAt(state.tiles, 4, 3)!.terrain = ["uneasy"];
    addTestEnemy(state, "e1", 3, 3, { name: GROUND_ENEMY });
    state.enemies[0]!.movementRemaining = 1;
    expect(validateEnemyMove(state, "e1", 4, 3)).toBe("Not enough movement");

    state.enemies[0]!.movementRemaining = 2;
    expect(validateEnemyMove(state, "e1", 4, 3)).toBeNull();
    applyEnemyMove(state, "e1", 4, 3);
    expect(state.enemies[0]!.movementRemaining).toBe(0);
  });

  it("non-swarm enemy spends 2 uphill; Seeking spends 1", () => {
    const state = makeGameState({ roundPhase: "gmTurn", turn: { role: "gm" } });
    tileAt(state.tiles, 4, 3)!.elevation = 1;
    addTestEnemy(state, "e1", 3, 3, { name: GROUND_ENEMY });
    state.enemies[0]!.movementRemaining = 2;
    applyEnemyMove(state, "e1", 4, 3);
    expect(state.enemies[0]!.movementRemaining).toBe(0);

    const seeking = makeGameState({ roundPhase: "gmTurn", turn: { role: "gm" } });
    tileAt(seeking.tiles, 4, 3)!.elevation = 1;
    addTestEnemy(seeking, "e1", 3, 3, { name: GROUND_ENEMY, effects: { Seeking: 1 } });
    seeking.enemies[0]!.movementRemaining = 2;
    applyEnemyMove(seeking, "e1", 4, 3);
    expect(seeking.enemies[0]!.movementRemaining).toBe(1);
  });

  it("swarm rearrange onto Uneasy spends 2", () => {
    const state = makeGameState({ roundPhase: "gmTurn", turn: { role: "gm" } });
    addTestEnemy(state, "a", 2, 2, { name: SWARM_NAME });
    addTestEnemy(state, "b", 3, 2, { name: SWARM_NAME });
    for (const e of state.enemies) e.movementRemaining = 6;
    reconcileSwarmMovement(state);
    tileAt(state.tiles, 2, 3)!.terrain = ["uneasy"];

    expect(validateSwarmMove(state, "a", 2, 3)).toBeNull();
    applySwarmMove(state, "a", 2, 3);
    expect(getSwarmMovementRemaining(state, ["a", "b"])).toBe(4);
  });

  it("swarm rearrange uphill still spends 1", () => {
    const state = makeGameState({ roundPhase: "gmTurn", turn: { role: "gm" } });
    addTestEnemy(state, "a", 2, 2, { name: SWARM_NAME });
    addTestEnemy(state, "b", 3, 2, { name: SWARM_NAME });
    for (const e of state.enemies) e.movementRemaining = 6;
    reconcileSwarmMovement(state);
    tileAt(state.tiles, 2, 3)!.elevation = 2;

    applySwarmMove(state, "a", 2, 3);
    expect(getSwarmMovementRemaining(state, ["a", "b"])).toBe(5);
  });

  it("Flying enemy onto Uneasy spends 1", () => {
    const state = makeGameState({ roundPhase: "gmTurn", turn: { role: "gm" } });
    tileAt(state.tiles, 4, 3)!.terrain = ["uneasy"];
    addTestEnemy(state, "e1", 3, 3, { name: FLYING_ENEMY });
    state.enemies[0]!.movementRemaining = 2;
    applyEnemyMove(state, "e1", 4, 3);
    expect(state.enemies[0]!.movementRemaining).toBe(1);
  });

  it("Flying swarm onto Uneasy spends 1", () => {
    const state = makeGameState({ roundPhase: "gmTurn", turn: { role: "gm" } });
    addTestEnemy(state, "a", 2, 2, { name: FLYING_SWARM });
    addTestEnemy(state, "b", 3, 2, { name: FLYING_SWARM });
    reconcileSwarmMovement(state);
    for (const e of state.enemies) e.movementRemaining = 4;
    tileAt(state.tiles, 2, 3)!.terrain = ["uneasy"];

    applySwarmMove(state, "a", 2, 3);
    expect(getSwarmMovementRemaining(state, ["a", "b"])).toBe(3);
  });

  it("Slow enemy onto standard spends 2", () => {
    const state = makeGameState({ roundPhase: "gmTurn", turn: { role: "gm" } });
    addTestEnemy(state, "e1", 3, 3, { name: GROUND_ENEMY, effects: { Slow: 1 } });
    state.enemies[0]!.movementRemaining = 2;
    expect(validateEnemyMove(state, "e1", 4, 3)).toBeNull();
    applyEnemyMove(state, "e1", 4, 3);
    expect(state.enemies[0]!.movementRemaining).toBe(0);
  });
});
