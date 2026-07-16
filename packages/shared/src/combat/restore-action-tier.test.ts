import { describe, expect, it } from "vitest";

import { restoreActionTier } from "./actions.js";
import {
  applyRestorePlayerActionTier,
  handleCombatMessage,
  validateRestorePlayerActionTier,
} from "./messages.js";
import { createDefaultActionBudget } from "./types.js";
import { addTestPlayer, makeGameState } from "../test/fixtures.js";

describe("restoreActionTier", () => {
  it("restores a spent tier and rejects already-unused", () => {
    const budget = createDefaultActionBudget(5);
    budget.main = false;
    expect(restoreActionTier(budget, "main")).toBe(true);
    expect(budget.main).toBe(true);
    expect(restoreActionTier(budget, "main")).toBe(false);
  });
});

describe("restorePlayerActionTier", () => {
  it("rejects non-GM, missing player, and unused tiers", () => {
    const state = makeGameState();
    const player = addTestPlayer(state, "p1");
    player.actionBudget!.main = false;

    expect(
      handleCombatMessage(
        state,
        { type: "restorePlayerActionTier", playerId: "p1", tier: "main" },
        { role: "player", playerId: "p1" },
      ),
    ).toEqual({ handled: true, error: "Only GM can do that" });

    expect(validateRestorePlayerActionTier(state, "missing", "main")).toBe("Unknown player");
    expect(validateRestorePlayerActionTier(state, "p1", "support")).toBe("Action not spent");
  });

  it("restores spent tier and clears matching haste commit", () => {
    const state = makeGameState();
    const player = addTestPlayer(state, "p1", { class: "HARPE" });
    player.actionBudget!.support = false;
    player.hasteActionTier = "support";

    const err = validateRestorePlayerActionTier(state, "p1", "support");
    expect(err).toBeNull();

    const msg = applyRestorePlayerActionTier(state, "p1", "support");
    expect(player.actionBudget!.support).toBe(true);
    expect(player.hasteActionTier).toBeUndefined();
    expect(msg).toContain("Support");

    const result = handleCombatMessage(
      state,
      { type: "restorePlayerActionTier", playerId: "p1", tier: "aux" },
      { role: "gm", playerId: null },
    );
    expect(result).toEqual({ handled: true, error: "Action not spent" });

    player.actionBudget!.aux = false;
    const ok = handleCombatMessage(
      state,
      { type: "restorePlayerActionTier", playerId: "p1", tier: "aux" },
      { role: "gm", playerId: null },
    );
    expect(ok).toMatchObject({ handled: true });
    expect("error" in ok).toBe(false);
    expect(player.actionBudget!.aux).toBe(true);
  });
});
