import { describe, expect, it } from "vitest";
import {
  buildBoardOccupancy,
  occupancyBlockedByEnemy,
  validateEnemyFootprint,
} from "./game.js";
import { addTestEnemy, makeGameState } from "./test/fixtures.js";

describe("ShareSpace occupancy", () => {
  it("ShareSpace occupant does not block occupancy", () => {
    const state = makeGameState();
    addTestEnemy(state, "s", 2, 2, { name: "Test Swarmling" });
    const occ = buildBoardOccupancy(state);
    expect(occupancyBlockedByEnemy(occ, 2, 2)).toBe(false);
  });

  it("burrowed occupant does not block occupancy", () => {
    const state = makeGameState();
    const e = addTestEnemy(state, "g", 2, 2, { name: "Test Grunt" });
    e.burrowed = true;
    const occ = buildBoardOccupancy(state);
    expect(occupancyBlockedByEnemy(occ, 2, 2)).toBe(false);
  });

  it("solid enemy blocks occupancy even when ShareSpace stacks under it", () => {
    const state = makeGameState();
    addTestEnemy(state, "s", 2, 2, { name: "Test Swarmling" });
    addTestEnemy(state, "g", 2, 2, { name: "Test Grunt" });
    const occ = buildBoardOccupancy(state);
    expect(occupancyBlockedByEnemy(occ, 2, 2)).toBe(true);
  });

  it("non-ShareSpace mover may enter ShareSpace-only tile", () => {
    const state = makeGameState();
    addTestEnemy(state, "s", 3, 3, { name: "Test Swarmling" });
    expect(
      validateEnemyFootprint(state, 3, 3, 1, "g", undefined, { name: "Test Grunt" }),
    ).toBeNull();
  });

  it("non-ShareSpace mover is blocked by solid enemy", () => {
    const state = makeGameState();
    addTestEnemy(state, "g2", 3, 3, { name: "Test Grunt" });
    expect(
      validateEnemyFootprint(state, 3, 3, 1, "g", undefined, { name: "Test Grunt" }),
    ).toBe("Tile occupied");
  });

  it("ShareSpace mover may enter solid-enemy tile", () => {
    const state = makeGameState();
    addTestEnemy(state, "g", 3, 3, { name: "Test Grunt" });
    expect(
      validateEnemyFootprint(state, 3, 3, 1, "s", undefined, { name: "Test Swarmling" }),
    ).toBeNull();
  });

  it("excludeEnemyId skips self when validating footprint", () => {
    const state = makeGameState();
    addTestEnemy(state, "g", 3, 3, { name: "Test Grunt" });
    expect(
      validateEnemyFootprint(state, 3, 3, 1, "g", undefined, { name: "Test Grunt" }),
    ).toBeNull();
  });
});
