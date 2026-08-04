import { describe, expect, it } from "vitest";
import {
  applyResetToStartingState,
  applySaveStartingState,
  assertLegalMapEnemyFootprints,
  createBlankGameMap,
  parseGameMap,
  persistMapEnemiesFromState,
} from "./map.js";
import { makeGameState } from "./test/fixtures.js";

function blankTiles(width: number, height: number) {
  return createBlankGameMap("t", "T", width, height).tiles;
}

describe("map enemy footprints", () => {
  it("allows ShareSpace enemies to stack on the same tile", () => {
    const map = parseGameMap({
      id: "share",
      width: 4,
      height: 4,
      tiles: blankTiles(4, 4),
      enemies: [
        { id: "a", x: 1, y: 1, name: "Test Swarmling" },
        { id: "b", x: 1, y: 1, name: "Test Swarmling" },
      ],
    });
    expect(map.enemies).toHaveLength(2);
  });

  it("rejects non-ShareSpace footprint overlaps", () => {
    expect(() =>
      parseGameMap({
        id: "overlap",
        width: 4,
        height: 4,
        tiles: blankTiles(4, 4),
        enemies: [
          { id: "a", x: 1, y: 1, name: "Test Grunt" },
          { id: "b", x: 1, y: 1, name: "Test Grunt" },
        ],
      }),
    ).toThrow(/Enemy footprints overlap at \(1, 1\)/);
  });

  it("allows a ShareSpace enemy to underlap a non-ShareSpace enemy", () => {
    expect(() =>
      assertLegalMapEnemyFootprints(
        [
          { id: "a", x: 2, y: 2, name: "Test Grunt", scale: 1 },
          { id: "b", x: 2, y: 2, name: "Test Swarmling", scale: 1 },
        ],
        4,
        4,
      ),
    ).not.toThrow();
  });

  it("still rejects two non-ShareSpace enemies stacked via a ShareSpace underlap", () => {
    expect(() =>
      assertLegalMapEnemyFootprints(
        [
          { id: "a", x: 2, y: 2, name: "Test Grunt", scale: 1 },
          { id: "b", x: 2, y: 2, name: "Test Swarmling", scale: 1 },
          { id: "c", x: 2, y: 2, name: "Test Grunt", scale: 1 },
        ],
        4,
        4,
      ),
    ).toThrow(/Enemy footprints overlap at \(2, 2\)/);
  });

  it("persistMapEnemiesFromState keeps ShareSpace stacks loadable", () => {
    const state = makeGameState({
      width: 4,
      height: 4,
      enemies: [
        { id: "a", x: 1, y: 1, name: "Test Swarmling", scale: 1, hp: 5 },
        { id: "b", x: 1, y: 1, name: "Test Swarmling", scale: 1, hp: 5 },
      ],
    });
    const map = createBlankGameMap("share", "Share", 4, 4);
    persistMapEnemiesFromState(state, map);
    expect(() => parseGameMap(JSON.parse(JSON.stringify(map)))).not.toThrow();
    expect(parseGameMap(JSON.parse(JSON.stringify(map))).enemies).toHaveLength(2);
  });

  it("persistMapEnemiesFromState refuses illegal overlaps", () => {
    const state = makeGameState({
      width: 4,
      height: 4,
      enemies: [
        { id: "a", x: 1, y: 1, name: "Test Grunt", scale: 1, hp: 10 },
        { id: "b", x: 1, y: 1, name: "Test Grunt", scale: 1, hp: 10 },
      ],
    });
    const map = createBlankGameMap("bad", "Bad", 4, 4);
    expect(() => persistMapEnemiesFromState(state, map)).toThrow(/Enemy footprints overlap/);
    expect(map.enemies).toBeUndefined();
  });

  // VTT-86: placing a ShareSpace enemy (e.g. Living Tide) on a tile already
  // occupied by a solid enemy is legal in play, so saving/resetting starting
  // state must not drop it.
  it("save and reset starting state keeps a ShareSpace enemy stacked on a solid enemy", () => {
    const map = createBlankGameMap("stack", "Stack", 4, 4);
    const state = makeGameState({
      width: 4,
      height: 4,
      enemies: [
        { id: "grunt", x: 1, y: 1, name: "Test Grunt", scale: 1, hp: 10 },
        { id: "swarm", x: 1, y: 1, name: "Test Swarmling", scale: 1, hp: 5 },
      ],
    });

    expect(applySaveStartingState(state, map)).toBe("Starting state saved");
    expect(map.startingState?.enemies).toHaveLength(2);

    state.enemies = state.enemies.filter((e) => e.id !== "swarm");
    expect(applyResetToStartingState(state, map)).toBe("Board reset to starting state");
    expect(state.enemies.map((e) => e.id).sort()).toEqual(["grunt", "swarm"]);
  });
});
