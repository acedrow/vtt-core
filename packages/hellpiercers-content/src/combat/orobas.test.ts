import { stainMapTile } from "./stainwalk.js";
import { describe, expect, it } from "vitest";
import { applyGmEnemyAction, validateGmEnemyAction } from "@gaem/shared";
import { addTestEnemy, addTestPlayer, makeGameState } from "../suite/fixtures.js";

describe("orobas-stained-line", () => {
  it("registers specialId handler and deals 8 damage on stained targets", () => {
    const state = makeGameState({ width: 12, height: 12 });
    const player = addTestPlayer(state, "p1", { x: 5, y: 2, hp: 25, class: "HARPE" });
    addTestEnemy(state, "e1", 5, 5, { name: "OROBAS", scale: 1, hp: 30 });
    stainMapTile(state, 5, 2);
    state.roundPhase = "gmTurn";
    state.turn = { role: "gm" };

    const action = {
      action: "attack" as const,
      enemyId: "e1",
      attackIndex: 0,
      direction: "n" as const,
    };
    expect(validateGmEnemyAction(state, action)).toBeNull();
    const msg = applyGmEnemyAction(state, action);
    expect(msg).toMatch(/Line:4/);
    expect(msg).toMatch(/8/);
    expect(player.hp).toBe(17);
  });

  it("deals 3 damage when target is not on stain", () => {
    const state = makeGameState({ width: 12, height: 12 });
    const player = addTestPlayer(state, "p1", { x: 5, y: 2, hp: 25, class: "HARPE" });
    addTestEnemy(state, "e1", 5, 5, { name: "OROBAS", scale: 1, hp: 30 });
    state.roundPhase = "gmTurn";
    state.turn = { role: "gm" };

    applyGmEnemyAction(state, {
      action: "attack",
      enemyId: "e1",
      attackIndex: 0,
      direction: "n",
    });
    expect(player.hp).toBe(22);
  });
});
