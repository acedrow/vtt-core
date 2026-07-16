import { describe, expect, it } from "vitest";

import { coordKey } from "../map.js";
import { addTestEnemy, addTestPlayer, makeGameState, makeTiles } from "../test/fixtures.js";
import { createDefaultCombatState } from "./types.js";
import {
  applyAssistedLaunch,
  assistedLaunchAnchors,
  canUseAssistedLaunch,
  computeAssistedLaunch,
  KUSHIEL_ARMOR_NAME,
  validateAssistedLaunch,
} from "./assisted-launch.js";

function playerTurn(state: ReturnType<typeof makeGameState>, playerId: string) {
  state.roundPhase = "playerTurn";
  state.turn = { role: "player", playerId };
  state.combat = createDefaultCombatState(state.players.length);
}

describe("assisted launch", () => {
  it("launches away from obstacle terrain", () => {
    const tiles = makeTiles(6, 6);
    tiles.find((t) => t.x === 2 && t.y === 0)!.terrain = ["obstacle"];
    const state = makeGameState({ width: 6, height: 6, tiles });
    addTestPlayer(state, "p1", { x: 2, y: 1, armor: KUSHIEL_ARMOR_NAME });
    playerTurn(state, "p1");

    const anchors = assistedLaunchAnchors(state, "p1");
    expect(anchors).toHaveLength(1);
    expect(anchors[0]!.kind).toBe("obstacle");

    const result = computeAssistedLaunch(state, "p1", 2, 0)!;
    expect(result.landing.y).toBeGreaterThan(1);
  });

  it("launches from map edge as impassable anchor", () => {
    const state = makeGameState({ width: 6, height: 6 });
    addTestPlayer(state, "p1", { x: 0, y: 2, armor: KUSHIEL_ARMOR_NAME });
    playerTurn(state, "p1");

    const anchors = assistedLaunchAnchors(state, "p1");
    expect(anchors).toHaveLength(1);
    expect(anchors[0]!.kind).toBe("edge");
    expect(anchors[0]!.x).toBe(-1);
    expect(anchors[0]!.y).toBe(2);

    const result = computeAssistedLaunch(state, "p1", -1, 2)!;
    expect(result.landing.x).toBeGreaterThan(0);
  });

  it("does not treat void terrain as a launch anchor", () => {
    const tiles = makeTiles(6, 6);
    tiles.find((t) => t.x === 2 && t.y === 0)!.terrain = ["void"];
    const state = makeGameState({ width: 6, height: 6, tiles });
    addTestPlayer(state, "p1", { x: 2, y: 1, armor: KUSHIEL_ARMOR_NAME });
    playerTurn(state, "p1");

    expect(assistedLaunchAnchors(state, "p1")).toHaveLength(0);
  });

  it("slides away from wall until adjacent to obstacle", () => {
    const blocked = new Set([coordKey(2, 0), coordKey(2, 5)]);
    const state = makeGameState({ width: 6, height: 6, tiles: makeTiles(6, 6, blocked) });
    addTestPlayer(state, "p1", { x: 2, y: 1, armor: KUSHIEL_ARMOR_NAME });
    playerTurn(state, "p1");

    const anchors = assistedLaunchAnchors(state, "p1");
    expect(anchors).toHaveLength(1);
    expect(anchors[0]!.kind).toBe("impassable");

    const result = computeAssistedLaunch(state, "p1", 2, 0)!;
    expect(result.path).toEqual([
      { x: 2, y: 2 },
      { x: 2, y: 3 },
      { x: 2, y: 4 },
    ]);
    expect(result.landing).toEqual({ x: 2, y: 4 });
  });

  it("launches away from ally", () => {
    const state = makeGameState({ width: 6, height: 6 });
    addTestPlayer(state, "p1", { x: 2, y: 2, armor: KUSHIEL_ARMOR_NAME });
    addTestPlayer(state, "p2", { x: 1, y: 2, armor: "MALAKBEL" });
    playerTurn(state, "p1");

    const anchors = assistedLaunchAnchors(state, "p1");
    expect(anchors.some((a) => a.kind === "ally" && a.allyId === "p2")).toBe(true);

    const result = computeAssistedLaunch(state, "p1", 1, 2)!;
    expect(result.landing.x).toBeGreaterThan(2);
  });

  it("stops adjacent to enemy", () => {
    const state = makeGameState({ width: 6, height: 6 });
    addTestPlayer(state, "p1", { x: 2, y: 2, armor: KUSHIEL_ARMOR_NAME });
    addTestEnemy(state, "e1", 2, 4);
    const blocked = new Set([coordKey(2, 1)]);
    state.tiles = makeTiles(6, 6, blocked);
    playerTurn(state, "p1");

    const result = computeAssistedLaunch(state, "p1", 2, 1)!;
    expect(result.landing).toEqual({ x: 2, y: 3 });
  });

  it("stops adjacent to special terrain", () => {
    const blocked = new Set([coordKey(2, 1)]);
    const state = makeGameState({ width: 6, height: 6, tiles: makeTiles(6, 6, blocked) });
    addTestPlayer(state, "p1", { x: 2, y: 2, armor: KUSHIEL_ARMOR_NAME });
    state.tiles.find((t) => t.x === 2 && t.y === 4)!.terrain = ["uneasy"];
    playerTurn(state, "p1");

    const result = computeAssistedLaunch(state, "p1", 2, 1)!;
    expect(result.landing).toEqual({ x: 2, y: 3 });
  });

  it("rejects zero-movement anchors", () => {
    const blocked = new Set([coordKey(2, 1), coordKey(2, 3)]);
    const state = makeGameState({ width: 6, height: 6, tiles: makeTiles(6, 6, blocked) });
    addTestPlayer(state, "p1", { x: 2, y: 2, armor: KUSHIEL_ARMOR_NAME });
    playerTurn(state, "p1");

    expect(assistedLaunchAnchors(state, "p1")).toHaveLength(0);
    expect(canUseAssistedLaunch(state, "p1")).toBe(false);
  });

  it("validate and apply mark used", () => {
    const blocked = new Set([coordKey(2, 0)]);
    const state = makeGameState({ width: 6, height: 6, tiles: makeTiles(6, 6, blocked) });
    addTestPlayer(state, "p1", { x: 2, y: 1, armor: KUSHIEL_ARMOR_NAME });
    playerTurn(state, "p1");

    expect(validateAssistedLaunch(state, "p1", 2, 0)).toBeNull();
    applyAssistedLaunch(state, "p1", 2, 0);
    expect(state.players[0]!.y).toBeGreaterThan(1);
    expect(state.players[0]!.counters?.assistedLaunchUsed).toBe(1);
    expect(canUseAssistedLaunch(state, "p1")).toBe(false);
  });

  it("requires turn-start position", () => {
    const blocked = new Set([coordKey(2, 0)]);
    const state = makeGameState({ width: 6, height: 6, tiles: makeTiles(6, 6, blocked) });
    addTestPlayer(state, "p1", { x: 2, y: 1, armor: KUSHIEL_ARMOR_NAME });
    playerTurn(state, "p1");
    state.players[0]!.x = 3;

    expect(canUseAssistedLaunch(state, "p1")).toBe(false);
    expect(validateAssistedLaunch(state, "p1", 2, 0)).toBe("Must be at turn-start position");
  });
});
