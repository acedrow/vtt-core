import { describe, expect, it } from "vitest";
import {
  applySprintBegin,
  applySprintMove,
  maxSprintCost,
  validateSprintBegin,
  validateSprintMove,
} from "@gaem/shared";
import { applyPlayerAction, validatePlayerAction } from "@gaem/shared";
import { createDefaultCombatState } from "@gaem/shared";
import { addTestPlayer, makeGameState } from "../fixtures.js";

function combatPlayerTurn(state: ReturnType<typeof makeGameState>, playerId: string) {
  state.roundPhase = "playerTurn";
  state.turn = { role: "player", playerId };
  state.combat = createDefaultCombatState(state.players.length);
}

describe("sprint", () => {
  it("maxSprintCost is half Speed rounded up", () => {
    const state = makeGameState();
    expect(maxSprintCost(addTestPlayer(state, "a", { speed: 4 }))).toBe(2);
    expect(maxSprintCost(addTestPlayer(state, "b", { speed: 5 }))).toBe(3);
    expect(maxSprintCost(addTestPlayer(state, "c", { speed: 7 }))).toBe(4);
  });

  it("begin spends Aux and grants half Speed", () => {
    const state = makeGameState();
    const player = addTestPlayer(state, "p1", { x: 2, y: 2, speed: 6 });
    combatPlayerTurn(state, "p1");

    expect(validateSprintBegin(state, "p1")).toBeNull();
    applySprintBegin(state, "p1");
    expect(player.actionBudget!.aux).toBe(false);
    expect(player.actionBudget!.sprintRemaining).toBe(3);
    expect(player.actionBudget!.sprintMax).toBe(3);
    expect(player.actionBudget!.movementRemaining).toBe(6);
  });

  it("rejects begin when Pin or Falling", () => {
    const pinned = makeGameState();
    addTestPlayer(pinned, "p1", { x: 2, y: 2, speed: 4, effects: { Pin: 1 } });
    combatPlayerTurn(pinned, "p1");
    expect(validateSprintBegin(pinned, "p1")).toBe("Pinned — cannot Sprint");

    const falling = makeGameState();
    const p = addTestPlayer(falling, "p1", { x: 2, y: 2, speed: 4 });
    p.falling = { peak: 2 };
    combatPlayerTurn(falling, "p1");
    expect(validateSprintBegin(falling, "p1")).toBe("Falling — cannot Sprint");
  });

  it("rejects begin when Aux spent", () => {
    const state = makeGameState();
    const player = addTestPlayer(state, "p1", { x: 2, y: 2, speed: 4 });
    combatPlayerTurn(state, "p1");
    player.actionBudget!.aux = false;
    expect(validateSprintBegin(state, "p1")).toBe("Aux action spent");
  });

  it("sprint steps spend sprint budget, not free movement", () => {
    const state = makeGameState();
    const player = addTestPlayer(state, "p1", { x: 2, y: 2, speed: 4 });
    combatPlayerTurn(state, "p1");
    applySprintBegin(state, "p1");

    expect(validateSprintMove(state, "p1", 3, 2)).toBeNull();
    applySprintMove(state, "p1", 3, 2);
    expect(player.x).toBe(3);
    expect(player.y).toBe(2);
    expect(player.actionBudget!.sprintRemaining).toBe(1);
    expect(player.actionBudget!.movementRemaining).toBe(4);
  });

  it("Slow doubles sprint step cost", () => {
    const state = makeGameState();
    const player = addTestPlayer(state, "p1", {
      x: 2,
      y: 2,
      speed: 4,
      effects: { Slow: 1 },
    });
    combatPlayerTurn(state, "p1");
    applySprintBegin(state, "p1");
    expect(player.actionBudget!.sprintRemaining).toBe(2);

    expect(validateSprintMove(state, "p1", 3, 2)).toBeNull();
    applySprintMove(state, "p1", 3, 2);
    expect(player.actionBudget!.sprintRemaining).toBe(0);
    expect(player.actionBudget!.sprintMax).toBe(0);
  });

  it("uneasy terrain costs extra sprint movement", () => {
    const state = makeGameState();
    const tile = state.tiles.find((t) => t.x === 3 && t.y === 2)!;
    tile.terrain = ["uneasy"];
    const player = addTestPlayer(state, "p1", { x: 2, y: 2, speed: 4 });
    combatPlayerTurn(state, "p1");
    applySprintBegin(state, "p1");

    expect(validateSprintMove(state, "p1", 3, 2)).toBeNull();
    applySprintMove(state, "p1", 3, 2);
    expect(player.actionBudget!.sprintRemaining).toBe(0);
  });

  it("cancel clears remaining sprint without refunding Aux", () => {
    const state = makeGameState();
    const player = addTestPlayer(state, "p1", { x: 2, y: 2, speed: 6 });
    combatPlayerTurn(state, "p1");
    applyPlayerAction(state, "p1", { action: "sprint" });
    applyPlayerAction(state, "p1", { action: "sprintMove", x: 3, y: 2 });
    expect(player.actionBudget!.sprintRemaining).toBe(2);
    applyPlayerAction(state, "p1", { action: "sprintCancel" });
    expect(player.actionBudget!.sprintRemaining).toBe(0);
    expect(player.actionBudget!.aux).toBe(false);
    expect(validatePlayerAction(state, "p1", { action: "sprint" })).toBe("Aux action spent");
  });

  it("does not spend free movement when sprinting", () => {
    const state = makeGameState();
    const player = addTestPlayer(state, "p1", { x: 2, y: 2, speed: 5 });
    combatPlayerTurn(state, "p1");
    applyPlayerAction(state, "p1", { action: "sprint" });
    applyPlayerAction(state, "p1", { action: "sprintMove", x: 3, y: 2 });
    applyPlayerAction(state, "p1", { action: "sprintMove", x: 4, y: 2 });
    applyPlayerAction(state, "p1", { action: "sprintMove", x: 5, y: 2 });
    expect(player.actionBudget!.movementRemaining).toBe(5);
    expect(player.actionBudget!.sprintRemaining).toBe(0);
  });
});
