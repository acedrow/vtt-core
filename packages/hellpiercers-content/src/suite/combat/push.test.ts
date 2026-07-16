import { describe, expect, it } from "vitest";

import { addTestEnemy, addTestPlayer, makeGameState, makeTiles } from "../fixtures.js";
import { applyPlayerAction } from "@gaem/shared";
import { applyPushFromOrigin, applyRecoilFromTarget } from "@gaem/shared";
import { createDefaultCombatState } from "@gaem/shared";

function combatPlayerTurn(state: ReturnType<typeof makeGameState>, playerId: string) {
  state.roundPhase = "playerTurn";
  state.turn = { role: "player", playerId };
  state.combat = createDefaultCombatState(state.players.length);
}

describe("applyPushFromOrigin", () => {
  it("pushes an adjacent enemy away from the origin", () => {
    const state = makeGameState();
    addTestPlayer(state, "p1", { x: 2, y: 2, armor: "KUSHIEL" });
    addTestEnemy(state, "e1", 3, 2);
    const enemy = state.enemies[0]!;
    const msg = applyPushFromOrigin(state, enemy, 2, 2, 2, { kind: "enemy" });
    expect(enemy.x).toBe(5);
    expect(enemy.y).toBe(2);
    expect(msg).toContain("pushed");
  });

  it("pushes a scale:2 enemy without treating its own footprint as blocking", () => {
    const state = makeGameState({ width: 10, height: 10 });
    addTestPlayer(state, "p1", { x: 1, y: 2 });
    addTestEnemy(state, "e1", 3, 2, { name: "Gorgenaut", hp: 50 });
    const enemy = state.enemies[0]!;
    const msg = applyPushFromOrigin(state, enemy, 1, 2, 1, { kind: "enemy" });
    expect(enemy.x).toBe(4);
    expect(enemy.y).toBe(2);
    expect(msg).toContain("pushed");
  });

  it("deals collision damage when blocked by a wall", () => {
    const state = makeGameState({
      width: 5,
      height: 5,
      tiles: makeTiles(5, 5, new Set(["3,2"])),
    });
    addTestPlayer(state, "p1", { x: 1, y: 2 });
    addTestEnemy(state, "e1", 2, 2, { name: "Gorgenaut", hp: 5 });
    const enemy = state.enemies[0]!;
    enemy.hp = 5;
    applyPushFromOrigin(state, enemy, 1, 2, 3, { kind: "enemy" });
    expect(enemy.x).toBe(2);
    expect(enemy.y).toBe(2);
    expect(enemy.hp).toBe(2);
  });
});

describe("applyRecoilFromTarget", () => {
  it("moves the user away from the target", () => {
    const state = makeGameState();
    const player = addTestPlayer(state, "p1", { x: 2, y: 2, armor: "KUSHIEL" });
    applyRecoilFromTarget(state, player, 3, 2, 2);
    expect(player.x).toBe(0);
    expect(player.y).toBe(2);
  });
});

describe("Hasaphet's Palm armor action", () => {
  it("pushes a target and recoils the user", () => {
    const state = makeGameState();
    addTestPlayer(state, "p1", { x: 2, y: 2, armor: "KUSHIEL", actionBudget: true });
    addTestEnemy(state, "e1", 3, 2);
    combatPlayerTurn(state, "p1");
    const msg = applyPlayerAction(state, "p1", {
      action: "armorAction",
      targetEnemyId: "e1",
      push: 2,
    });
    expect(state.enemies[0]!.x).toBe(5);
    expect(state.players[0]!.x).toBe(0);
    expect(msg).toContain("Hasaphet's Palm");
    expect(state.players[0]!.actionBudget?.support).toBe(false);
  });

  it("can push an adjacent ally", () => {
    const state = makeGameState();
    addTestPlayer(state, "p1", { x: 2, y: 2, armor: "KUSHIEL", actionBudget: true });
    addTestPlayer(state, "p2", { x: 3, y: 2, actionBudget: false });
    combatPlayerTurn(state, "p1");
    applyPlayerAction(state, "p1", {
      action: "armorAction",
      targetPlayerId: "p2",
      push: 1,
    });
    expect(state.players.find((p) => p.id === "p2")!.x).toBe(4);
    expect(state.players[0]!.x).toBe(1);
  });

  it("can push a scale:2 enemy adjacent via non-anchor footprint", () => {
    const state = makeGameState({ width: 10, height: 10 });
    addTestPlayer(state, "p1", { x: 5, y: 2, armor: "KUSHIEL", actionBudget: true });
    // Gorgenaut at (3,2) occupies (3,2)(4,2)(3,3)(4,3); player is adjacent to (4,2)
    addTestEnemy(state, "e1", 3, 2, { name: "Gorgenaut", hp: 50 });
    combatPlayerTurn(state, "p1");
    const msg = applyPlayerAction(state, "p1", {
      action: "armorAction",
      targetEnemyId: "e1",
      push: 1,
    });
    expect(msg).toContain("Hasaphet's Palm");
    expect(state.enemies[0]!.x).toBe(2);
    expect(state.players[0]!.x).toBe(6);
  });
});
