import { describe, expect, it } from "vitest";
import {
  applyMovementPath,
  applyResetMovement,
  formlessLandingTiles,
  formlessTargetTileKeys,
  validateMovementPath,
  validateResetMovement,
} from "@gaem/shared";
import { applyPlayerAction, validatePlayerAction } from "@gaem/shared";
import { createDefaultCombatState } from "@gaem/shared";
import { addTestEnemy, addTestPlayer, makeGameState, makeTiles } from "../fixtures.js";
import { coordKey } from "@gaem/shared";

const SWARM_NAME = "Scorned Eyes";

function combatPlayerTurn(state: ReturnType<typeof makeGameState>, playerId: string) {
  state.roundPhase = "playerTurn";
  state.turn = { role: "player", playerId };
  state.combat = createDefaultCombatState(state.players.length);
}

describe("movement", () => {
  it("validateMovementPath rejects invalid paths", () => {
    const state = makeGameState({
      roundPhase: "playerTurn",
      turn: { role: "player", playerId: "p1" },
    });
    addTestPlayer(state, "p1", { x: 2, y: 2, speed: 5 });

    expect(validateMovementPath(state, "p1", [])).toBe("Empty path");
    expect(validateMovementPath(state, "p1", [{ x: 4, y: 2 }])).toBe(
      "Path must be adjacent steps",
    );

    const blocked = makeGameState({
      roundPhase: "playerTurn",
      turn: { role: "player", playerId: "p1" },
      tiles: makeTiles(8, 8, new Set([coordKey(3, 2)])),
    });
    addTestPlayer(blocked, "p1", { x: 2, y: 2, speed: 5 });
    expect(validateMovementPath(blocked, "p1", [{ x: 3, y: 2 }])).toBe("Blocked");

    const occupied = makeGameState({
      roundPhase: "playerTurn",
      turn: { role: "player", playerId: "p1" },
    });
    addTestPlayer(occupied, "p1", { x: 2, y: 2, speed: 5 });
    addTestPlayer(occupied, "p2", { x: 3, y: 2, speed: 5, actionBudget: false });
    expect(validateMovementPath(occupied, "p1", [{ x: 3, y: 2 }])).toBe("Tile occupied");
  });

  it("rejects movement when pinned", () => {
    const state = makeGameState({
      roundPhase: "playerTurn",
      turn: { role: "player", playerId: "p1" },
    });
    addTestPlayer(state, "p1", { x: 2, y: 2, speed: 5, effects: { Pin: 1 } });
    expect(validateMovementPath(state, "p1", [{ x: 3, y: 2 }])).toBe("Pinned — cannot move");
  });

  it("allows Malakbel to move diagonally", () => {
    const state = makeGameState({
      roundPhase: "playerTurn",
      turn: { role: "player", playerId: "p1" },
    });
    addTestPlayer(state, "p1", { x: 2, y: 2, speed: 5, armor: "MALAKBEL" });
    expect(validateMovementPath(state, "p1", [{ x: 3, y: 3 }])).toBeNull();
    expect(validateMovementPath(state, "p1", [{ x: 4, y: 2 }])).toBe("Path must be adjacent steps");
  });

  it("rejects diagonal movement for other armor", () => {
    const state = makeGameState({
      roundPhase: "playerTurn",
      turn: { role: "player", playerId: "p1" },
    });
    addTestPlayer(state, "p1", { x: 2, y: 2, speed: 5, armor: "KUSHIEL" });
    expect(validateMovementPath(state, "p1", [{ x: 3, y: 3 }])).toBe("Path must be adjacent steps");
  });

  it("applyMovementPath updates position and spends budget", () => {
    const state = makeGameState({
      roundPhase: "playerTurn",
      turn: { role: "player", playerId: "p1" },
    });
    const player = addTestPlayer(state, "p1", { x: 2, y: 2, speed: 5 });
    const err = applyMovementPath(state, "p1", [{ x: 3, y: 2 }, { x: 4, y: 2 }]);
    expect(err).toBeNull();
    expect(player.x).toBe(4);
    expect(player.y).toBe(2);
    expect(player.actionBudget!.movementRemaining).toBe(3);
  });

  it("validateResetMovement and applyResetMovement", () => {
    const state = makeGameState({
      roundPhase: "playerTurn",
      turn: { role: "player", playerId: "p1" },
    });
    const player = addTestPlayer(state, "p1", { x: 2, y: 2, speed: 5 });
    applyMovementPath(state, "p1", [{ x: 3, y: 2 }]);

    expect(validateResetMovement(state, "p1")).toBeNull();
    applyResetMovement(state, "p1");
    expect(player.x).toBe(2);
    expect(player.y).toBe(2);
    expect(player.actionBudget!.movementRemaining).toBe(5);

    const deployment = makeGameState({ roundPhase: "deployment" });
    addTestPlayer(deployment, "p1", { x: 2, y: 2 });
    expect(validateResetMovement(deployment, "p1")).toBe("Wrong phase");
  });
});

describe("Formless armor action", () => {
  it("lists adjacent enemy tiles as targets and valid landing spaces", () => {
    const state = makeGameState();
    addTestPlayer(state, "p1", { x: 2, y: 2, armor: "MALAKBEL" });
    addTestEnemy(state, "e1", 3, 2);

    expect([...formlessTargetTileKeys(state, 2, 2)]).toEqual(["3,2"]);
    expect(formlessLandingTiles(state, "p1", "e1")).toEqual(
      expect.arrayContaining([
        { x: 3, y: 1 },
        { x: 3, y: 3 },
        { x: 4, y: 2 },
      ]),
    );
    expect(formlessLandingTiles(state, "p1", "e1")).toHaveLength(3);
  });

  it("allows landing adjacent to any swarm member", () => {
    const state = makeGameState();
    addTestPlayer(state, "p1", { x: 1, y: 2, armor: "MALAKBEL" });
    addTestEnemy(state, "a", 2, 2, { name: SWARM_NAME });
    addTestEnemy(state, "b", 3, 2, { name: SWARM_NAME });

    const landings = formlessLandingTiles(state, "p1", "a");
    expect(landings).toContainEqual({ x: 4, y: 2 });
  });

  it("teleports the player and spends support", () => {
    const state = makeGameState();
    const player = addTestPlayer(state, "p1", { x: 2, y: 2, armor: "MALAKBEL", actionBudget: true });
    addTestEnemy(state, "e1", 3, 2);
    combatPlayerTurn(state, "p1");

    const msg = applyPlayerAction(state, "p1", {
      action: "armorAction",
      targetEnemyId: "e1",
      landingX: 3,
      landingY: 1,
    });
    expect(player.x).toBe(3);
    expect(player.y).toBe(1);
    expect(msg).toContain("Formless");
    expect(player.actionBudget?.support).toBe(false);
  });

  it("rejects landing spaces not adjacent to the target", () => {
    const state = makeGameState();
    addTestPlayer(state, "p1", { x: 2, y: 2, armor: "MALAKBEL", actionBudget: true });
    addTestEnemy(state, "e1", 3, 2);
    combatPlayerTurn(state, "p1");

    expect(
      validatePlayerAction(state, "p1", {
        action: "armorAction",
        targetEnemyId: "e1",
        landingX: 5,
        landingY: 2,
      }),
    ).toBe("Invalid landing space");
  });
});
