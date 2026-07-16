import { describe, expect, it } from "vitest";
import { applyGmEnemyAction } from "@gaem/shared";
import { createDefaultCombatState } from "@gaem/shared";
import { addTestEnemy, addTestPlayer, makeGameState } from "../fixtures.js";

function gmTurn(state: ReturnType<typeof makeGameState>) {
  state.roundPhase = "gmTurn";
  state.turn = { role: "gm" };
  state.combat = createDefaultCombatState(state.players.length);
  state.campaign!.constructedBaseUpgrades = ["ignorance-devouring-anchor"];
}

describe("Reversal trigger conditions", () => {
  it("MALAKBEL only triggers when the attacker is non-adjacent", () => {
    const state = makeGameState({ width: 10, height: 10 });
    gmTurn(state);
    const adjacent = addTestPlayer(state, "p1", { x: 5, y: 4, armor: "MALAKBEL" });
    adjacent.reversalCharges = 6;
    addTestEnemy(state, "e1", 5, 5, { name: "Shadowing Witness", hp: 1 });
    applyGmEnemyAction(state, {
      action: "attack",
      enemyId: "e1",
      attackIndex: 0,
      targetPlayerId: "p1",
    });
    expect(state.combat!.pendingReaction).toBeNull();

    const far = addTestPlayer(state, "p2", { x: 5, y: 3, armor: "MALAKBEL" });
    far.reversalCharges = 6;
    applyGmEnemyAction(state, {
      action: "attack",
      enemyId: "e1",
      attackIndex: 0,
      targetPlayerId: "p2",
    });
    expect(state.combat!.pendingReaction?.playerId).toBe("p2");
  });

  it("KUSHIEL only triggers when the attacker is adjacent", () => {
    const state = makeGameState({ width: 10, height: 10 });
    gmTurn(state);
    const far = addTestPlayer(state, "p1", { x: 5, y: 3, armor: "KUSHIEL" });
    far.reversalCharges = 5;
    addTestEnemy(state, "e1", 5, 5, { name: "Shadowing Witness", hp: 1 });
    applyGmEnemyAction(state, {
      action: "attack",
      enemyId: "e1",
      attackIndex: 0,
      targetPlayerId: "p1",
    });
    expect(state.combat!.pendingReaction).toBeNull();

    const adjacent = addTestPlayer(state, "p2", { x: 5, y: 4, armor: "KUSHIEL" });
    adjacent.reversalCharges = 5;
    applyGmEnemyAction(state, {
      action: "attack",
      enemyId: "e1",
      attackIndex: 0,
      targetPlayerId: "p2",
    });
    expect(state.combat!.pendingReaction?.playerId).toBe("p2");
  });

  it("ASMODEL triggers for an adjacent ally instead of the attacked player", () => {
    const state = makeGameState({ width: 10, height: 10 });
    gmTurn(state);
    const hit = addTestPlayer(state, "p1", { x: 5, y: 4 });
    const ally = addTestPlayer(state, "p2", { x: 5, y: 3, armor: "ASMODEL" });
    ally.reversalCharges = 6;
    addTestEnemy(state, "e1", 5, 5, { name: "Shadowing Witness", hp: 1 });
    applyGmEnemyAction(state, {
      action: "attack",
      enemyId: "e1",
      attackIndex: 0,
      targetPlayerId: "p1",
    });
    expect(state.combat!.pendingReaction?.playerId).toBe("p2");
    expect(hit.reversalCharges ?? 0).toBe(0);
  });
});
