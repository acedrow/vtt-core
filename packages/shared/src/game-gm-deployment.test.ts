import { describe, expect, it } from "vitest";

import { canPlayerMove, shouldHideTaccomMapFromPlayer } from "./game.js";
import { addTestPlayer, makeGameState } from "./test/fixtures.js";

describe("gmDeployment", () => {
  it("blocks player deployment moves when gmDeployment is enabled", () => {
    const state = makeGameState({ roundPhase: "deployment", gmDeployment: true });
    addTestPlayer(state, "p1");
    expect(canPlayerMove(state, "p1")).toBe(false);
  });

  it("allows player deployment moves when gmDeployment is off", () => {
    const state = makeGameState({ roundPhase: "deployment" });
    addTestPlayer(state, "p1");
    expect(canPlayerMove(state, "p1")).toBe(true);
  });
});

describe("shouldHideTaccomMapFromPlayer", () => {
  it("hides map during deployment when enforce sightlines and no token", () => {
    const state = makeGameState({
      roundPhase: "deployment",
      enforceSightlines: true,
    });
    expect(shouldHideTaccomMapFromPlayer(state, false)).toBe(true);
    expect(shouldHideTaccomMapFromPlayer(state, true)).toBe(false);
  });

  it("hides map during startRoundEffects when enforce sightlines and no token", () => {
    const state = makeGameState({
      roundPhase: "startRoundEffects",
      enforceSightlines: true,
    });
    expect(shouldHideTaccomMapFromPlayer(state, false)).toBe(true);
  });

  it("does not hide when enforce sightlines is off", () => {
    const state = makeGameState({ roundPhase: "deployment" });
    expect(shouldHideTaccomMapFromPlayer(state, false)).toBe(false);
  });
});
