import { describe, expect, it } from "vitest";
import { resolveCountdownExpiry } from "./countdown.js";
import { createDefaultCombatState } from "./types.js";
import { addTestPlayer, makeGameState } from "../test/fixtures.js";

describe("resolveCountdownExpiry", () => {
  it("unknown kind creates pending GM action", () => {
    const state = makeGameState({ combat: createDefaultCombatState(0) });
    const player = addTestPlayer(state, "p1", { x: 1, y: 1, class: "Test Class" });
    resolveCountdownExpiry({ state, unit: player });
    expect(state.combat!.pendingActions.some((p) => p.label === "Countdown expired")).toBe(true);
  });
});
