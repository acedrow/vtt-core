import { describe, expect, it } from "vitest";

import { applyGmApplyDamage, handleCombatMessage, validateGmApplyDamage } from "@gaem/shared";
import { addTestEnemy, addTestPlayer, makeGameState } from "../fixtures.js";

describe("gmApplyDamage", () => {
  it("rejects non-GM and invalid damage", () => {
    const state = makeGameState();
    addTestPlayer(state, "p1", { x: 2, y: 2, hp: 10 });
    expect(validateGmApplyDamage(state, { kind: "player", id: "p1" }, 0)).toBe("Invalid damage amount");
    expect(validateGmApplyDamage(state, { kind: "player", id: "missing" }, 3)).toBe("Unknown player");

    const gmResult = handleCombatMessage(
      state,
      { type: "gmApplyDamage", target: { kind: "player", id: "p1" }, amount: 3 },
      { role: "player", playerId: "p1" },
    );
    expect(gmResult).toEqual({ handled: true, error: "Only GM can do that" });
  });

  it("applies damage with damage events", () => {
    const state = makeGameState();
    addTestPlayer(state, "p1", { x: 2, y: 2, hp: 10, class: "HARPE" });
    addTestEnemy(state, "e1", 4, 4, { name: "Gorgenaut", hp: 8 });

    applyGmApplyDamage(state, { kind: "player", id: "p1" }, 3);
    expect(state.players[0]!.hp).toBe(7);
    expect(state.damageEvents).toEqual([{ x: 2, y: 2, amount: 3 }]);

    applyGmApplyDamage(state, { kind: "enemy", id: "e1" }, 2);
    expect(state.enemies[0]!.hp).toBe(6);
    expect(state.damageEvents).toHaveLength(2);
  });
});
