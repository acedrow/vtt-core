import { describe, expect, it } from "vitest";

import {
  areDeploymentZonesEnforced,
  findSpawn,
  validateMove,
} from "./game.js";
import { addTestPlayer, makeGameState } from "./test/fixtures.js";
import { tileAt } from "./map.js";

describe("deployment zone placement", () => {
  it("does not enforce when zone count is not greater than player count", () => {
    const state = makeGameState({ roundPhase: "deployment" });
    addTestPlayer(state, "p1", { x: 0, y: 0 });
    tileAt(state.tiles, 2, 2)!.deploymentZone = true;
    expect(areDeploymentZonesEnforced(state)).toBe(false);
    expect(validateMove(state, "p1", 3, 3)).toBeNull();
  });

  it("rejects non-zone tiles and allows zone tiles when enforced", () => {
    const state = makeGameState({ roundPhase: "deployment" });
    addTestPlayer(state, "p1", { x: 0, y: 0 });
    tileAt(state.tiles, 2, 2)!.deploymentZone = true;
    tileAt(state.tiles, 3, 3)!.deploymentZone = true;
    expect(areDeploymentZonesEnforced(state)).toBe(true);
    expect(validateMove(state, "p1", 4, 4)).toBe("Must deploy on a deployment zone");
    expect(validateMove(state, "p1", 2, 2)).toBeNull();
  });

  it("does not enforce outside deployment phase", () => {
    const state = makeGameState({ roundPhase: "playerTurn", turn: { role: "player", playerId: "p1" } });
    addTestPlayer(state, "p1", { x: 2, y: 2 });
    tileAt(state.tiles, 2, 2)!.deploymentZone = true;
    tileAt(state.tiles, 3, 2)!.deploymentZone = true;
    expect(areDeploymentZonesEnforced(state)).toBe(false);
    expect(validateMove(state, "p1", 3, 2)).toBeNull();
  });

  it("findSpawn prefers deployment zone tiles when present", () => {
    const state = makeGameState({ roundPhase: "deployment" });
    tileAt(state.tiles, 4, 4)!.deploymentZone = true;
    const spawn = findSpawn(state);
    expect(spawn).toEqual({ x: 4, y: 4 });
  });

  it("findSpawn uses deployment zone tiles on the board edge", () => {
    const state = makeGameState({ roundPhase: "deployment" });
    tileAt(state.tiles, 4, state.height - 1)!.deploymentZone = true;
    expect(findSpawn(state)).toEqual({ x: 4, y: state.height - 1 });
  });

  it("findSpawn falls back when no deployment zones exist", () => {
    const state = makeGameState({ roundPhase: "deployment" });
    const spawn = findSpawn(state);
    expect(spawn).toEqual({ x: 1, y: 1 });
  });
});
