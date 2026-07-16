import { describe, expect, it } from "vitest";
import {
  applyPhaseAction,
  canResetPhase,
  canRewindPhase,
  spawnPlayerFromSheet,
  validatePhaseAction,
} from "@gaem/shared";
import { addTestPlayer, gmCtx, makeGameState, playerCtx } from "./fixtures.js";

describe("phases", () => {
  function twoPlayerState() {
    const state = makeGameState();
    addTestPlayer(state, "p1", { x: 2, y: 2 });
    addTestPlayer(state, "p2", { x: 3, y: 2 });
    return state;
  }

  it("rejects wrong role and phase", () => {
    const state = twoPlayerState();
    expect(validatePhaseAction(state, "startTaccom", playerCtx("p1"))).toBe(
      "Only the game master can do that",
    );
    expect(validatePhaseAction(state, "endDeployment", gmCtx())).toBe("Wrong phase");
    expect(validatePhaseAction(state, "takeTurn", playerCtx("p1"))).toBe("Wrong phase");
    expect(validatePhaseAction(state, "doEffects", gmCtx())).toBe("Wrong phase");
  });

  it("canRewindPhase and canResetPhase at boundaries", () => {
    const notStarted = makeGameState();
    expect(canRewindPhase(notStarted)).toBe(false);
    expect(canResetPhase(notStarted)).toBe(false);

    const deployment = makeGameState({ roundPhase: "deployment" });
    expect(canRewindPhase(deployment)).toBe(true);
    expect(canResetPhase(deployment)).toBe(false);

    const playerTurn = makeGameState({
      roundPhase: "playerTurn",
      turn: { role: "player", playerId: "p1" },
    });
    expect(canResetPhase(playerTurn)).toBe(true);
  });

  it("runs TACCOM not started through end of round 1", () => {
    const state = twoPlayerState();

    expect(validatePhaseAction(state, "startTaccom", gmCtx())).toBeNull();
    applyPhaseAction(state, "startTaccom", gmCtx());
    expect(state.roundPhase).toBe("deployment");
    expect(state.turn).toEqual({ role: "gm" });

    expect(validatePhaseAction(state, "endDeployment", gmCtx())).toBeNull();
    applyPhaseAction(state, "endDeployment", gmCtx());
    expect(state.roundPhase).toBe("startRoundEffects");
    expect(state.turn).toEqual({ role: "gm" });
    expect(state.combat).toBeDefined();

    expect(validatePhaseAction(state, "doEffects", gmCtx())).toBeNull();
    applyPhaseAction(state, "doEffects", gmCtx());
    expect(state.roundPhase).toBe("playersChoice");
    expect(state.turn).toBeNull();

    expect(validatePhaseAction(state, "takeTurn", playerCtx("p1"))).toBeNull();
    applyPhaseAction(state, "takeTurn", playerCtx("p1"));
    expect(state.roundPhase).toBe("playerTurn");
    expect(state.turn).toEqual({ role: "player", playerId: "p1" });

    expect(validatePhaseAction(state, "endPlayerTurn", playerCtx("p1"))).toBeNull();
    applyPhaseAction(state, "endPlayerTurn", playerCtx("p1"));
    expect(state.roundPhase).toBe("gmTurn");
    expect(state.actedPlayerIds).toContain("p1");

    expect(validatePhaseAction(state, "endGmTurn", gmCtx())).toBeNull();
    applyPhaseAction(state, "endGmTurn", gmCtx());
    expect(state.roundPhase).toBe("playerTurn");
    expect(state.turn).toEqual({ role: "player", playerId: "p2" });

    expect(validatePhaseAction(state, "endPlayerTurn", playerCtx("p2"))).toBeNull();
    applyPhaseAction(state, "endPlayerTurn", playerCtx("p2"));
    expect(state.roundPhase).toBe("gmTurn");
    expect(state.actedPlayerIds).toEqual(["p1", "p2"]);

    expect(validatePhaseAction(state, "countdownTags", gmCtx())).toBeNull();
    applyPhaseAction(state, "countdownTags", gmCtx());
    expect(state.roundPhase).toBe("countdownTags");

    expect(validatePhaseAction(state, "endRound", gmCtx())).toBeNull();
    applyPhaseAction(state, "endRound", gmCtx());
    expect(state.round).toBe(2);
    expect(state.roundPhase).toBe("startRoundEffects");
    expect(state.actedPlayerIds).toEqual([]);
  });

  it("resetRound on round 1 returns to TACCOM not started", () => {
    const state = twoPlayerState();
    applyPhaseAction(state, "startTaccom", gmCtx());
    applyPhaseAction(state, "endDeployment", gmCtx());
    expect(state.roundPhase).toBe("startRoundEffects");

    applyPhaseAction(state, "resetRound", gmCtx());
    expect(state.round).toBe(1);
    expect(state.roundPhase).toBe("taccomNotStarted");
  });

  it("spawn during deployment does not skip player turns on round 1", () => {
    const state = makeGameState();
    applyPhaseAction(state, "startTaccom", gmCtx());
    expect(state.roundPhase).toBe("deployment");

    const a = spawnPlayerFromSheet(state, {
      id: "p1",
      characterSheetId: "sheet-1",
      className: "HARPE",
      armor: "Mail",
      weapon: "Kopis",
    });
    const b = spawnPlayerFromSheet(state, {
      id: "p2",
      characterSheetId: "sheet-2",
      className: "HARPE",
      armor: "Mail",
      weapon: "Kopis",
    });
    expect(a).toEqual({ playerId: "p1" });
    expect(b).toEqual({ playerId: "p2" });
    expect(state.actedPlayerIds).toEqual(["p1", "p2"]);

    applyPhaseAction(state, "endDeployment", gmCtx());
    expect(state.roundPhase).toBe("startRoundEffects");
    expect(state.actedPlayerIds).toEqual([]);

    applyPhaseAction(state, "doEffects", gmCtx());
    expect(state.roundPhase).toBe("playersChoice");
    expect(state.turn).toBeNull();
    expect(state.actedPlayerIds).toEqual([]);
  });
});
