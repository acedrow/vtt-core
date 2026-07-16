import { describe, expect, it } from "vitest";
import {
  aegisFlyingRemaining,
  ASSISTED_ASCENSION_GEAR,
  ensureAssistedAscensionAegis,
  isFlyingStepReachable,
  resolveFlyingMask,
  spendAegisFlying,
} from "@gaem/shared";
import { applyMovePath, validateMovePath } from "@gaem/shared";
import { applyResetMovement, validateResetMovement, validateMovementPath } from "@gaem/shared";
import { previewPathProvokes } from "@gaem/shared";
import { tickUnitEndOfTurn } from "@gaem/shared";
import { addTestEnemy, addTestPlayer, makeGameState, makeTiles } from "../fixtures.js";
import { coordKey } from "@gaem/shared";

describe("aegis", () => {
  it("allows one flying step over void without spending Aegis stacks mid-turn", () => {
    const state = makeGameState({
      roundPhase: "playerTurn",
      turn: { role: "player", playerId: "p1" },
      tiles: makeTiles(8, 8, new Set([coordKey(3, 2)])),
    });
    state.tiles.find((t) => t.x === 3 && t.y === 2)!.terrain = ["void"];
    const player = addTestPlayer(state, "p1", { x: 2, y: 2, speed: 4, effects: { Aegis: 1 } });
    expect(validateMovePath(state, "p1", [{ x: 3, y: 2 }], true)).toBeNull();
    applyMovePath(state, "p1", [{ x: 3, y: 2 }], true);
    expect(player.x).toBe(3);
    expect(player.effects?.Aegis).toBe(1);
    expect(player.actionBudget!.movementRemaining).toBe(3);
    expect(aegisFlyingRemaining(player)).toBe(0);
  });

  it("rejects a second flying step when budget is exhausted", () => {
    const state = makeGameState({
      roundPhase: "playerTurn",
      turn: { role: "player", playerId: "p1" },
      tiles: makeTiles(8, 8, new Set([coordKey(3, 2), coordKey(4, 2)])),
    });
    for (const x of [3, 4]) state.tiles.find((t) => t.x === x && t.y === 2)!.terrain = ["void"];
    const player = addTestPlayer(state, "p1", { x: 2, y: 2, speed: 4, effects: { Aegis: 1 } });
    spendAegisFlying(player, 1);
    expect(validateMovePath(state, "p1", [{ x: 3, y: 2 }], true)).toBe("Not enough Aegis flight");
  });

  it("flying step does not provoke when leaving enemy range", () => {
    const state = makeGameState({
      roundPhase: "playerTurn",
      turn: { role: "player", playerId: "p1" },
    });
    addTestPlayer(state, "p1", { x: 2, y: 2, speed: 4, effects: { Aegis: 1 } });
    addTestEnemy(state, "e1", 2, 3, { hp: 5 });
    expect(previewPathProvokes(state, "p1", [{ x: 2, y: 1 }], { flying: true })).toHaveLength(0);
    expect(previewPathProvokes(state, "p1", [{ x: 2, y: 1 }])).toHaveLength(1);
  });

  it("decrements Aegis at end of turn", () => {
    const state = makeGameState();
    const player = addTestPlayer(state, "p1", { x: 1, y: 1, effects: { Aegis: 2 } });
    tickUnitEndOfTurn(state, player);
    expect(player.effects?.Aegis).toBe(1);
  });

  it("Assisted Ascension keeps Aegis at 1 through end of turn", () => {
    const state = makeGameState();
    const player = addTestPlayer(state, "p1", {
      x: 1,
      y: 1,
      gearArmor: ASSISTED_ASCENSION_GEAR,
      effects: { Aegis: 1 },
    });
    tickUnitEndOfTurn(state, player);
    expect(player.effects?.Aegis).toBe(1);
  });

  it("Assisted Ascension restores Aegis at turn start", () => {
    const state = makeGameState({ players: [] });
    const player = addTestPlayer(state, "p1", {
      x: 1,
      y: 1,
      gearArmor: ASSISTED_ASCENSION_GEAR,
      effects: {},
    });
    ensureAssistedAscensionAegis(player);
    expect(player.effects?.Aegis).toBe(1);
  });

  it("reset movement clears aegis flying used", () => {
    const state = makeGameState({
      roundPhase: "playerTurn",
      turn: { role: "player", playerId: "p1" },
    });
    const player = addTestPlayer(state, "p1", { x: 2, y: 2, speed: 4, effects: { Aegis: 2 } });
    player.turnStartX = 2;
    player.turnStartY = 2;
    spendAegisFlying(player, 1);
    applyMovePath(state, "p1", [{ x: 3, y: 2 }]);
    expect(validateResetMovement(state, "p1")).toBeNull();
    applyResetMovement(state, "p1");
    expect(aegisFlyingRemaining(player)).toBe(2);
  });

  it("isFlyingStepReachable allows void tiles", () => {
    const state = makeGameState({
      tiles: makeTiles(5, 5, new Set([coordKey(1, 2)])),
    });
    state.tiles.find((t) => t.x === 1 && t.y === 2)!.terrain = ["void"];
    const player = addTestPlayer(state, "p1", { x: 1, y: 1, speed: 4, effects: { Aegis: 1 } });
    expect(isFlyingStepReachable(state, player, { x: 1, y: 1 }, { x: 1, y: 2 })).toBe(true);
    expect(validateMovementPath(state, "p1", [{ x: 1, y: 2 }])).toBe("Blocked");
    expect(
      validateMovementPath(state, "p1", [{ x: 1, y: 2 }], { flyingMask: [true] }),
    ).toBeNull();
  });

  it("resolveFlyingMask expands boolean to per-step mask", () => {
    expect(resolveFlyingMask(3, true)).toEqual([true, true, true]);
    expect(resolveFlyingMask(2, [true, false])).toEqual([true, false]);
    expect(resolveFlyingMask(2, [true])).toBeNull();
  });
});
