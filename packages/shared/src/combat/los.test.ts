import { describe, expect, it } from "vitest";
import {
  hasLineOfSight,
  outOfLineOfSightTileKeys,
  tilesOnCardinalLine,
  visibleEnemyIds,
  visibleTileKeys,
} from "./los.js";
import { makeGameState } from "../test/fixtures.js";
import { tileAt } from "../map.js";

function setTerrain(state: ReturnType<typeof makeGameState>, x: number, y: number, terrain: string) {
  tileAt(state.tiles, x, y)!.terrain = [terrain as "standard"];
}

function setElevation(state: ReturnType<typeof makeGameState>, x: number, y: number, elevation: number) {
  tileAt(state.tiles, x, y)!.elevation = elevation;
}

function makePitState(): ReturnType<typeof makeGameState> {
  const state = makeGameState();
  for (let y = 2; y <= 4; y++) {
    for (let x = 2; x <= 4; x++) {
      setElevation(state, x, y, -3);
    }
  }
  return state;
}

describe("hasLineOfSight", () => {
  it("allows diagonal LOS through open ground", () => {
    const state = makeGameState();
    expect(hasLineOfSight(state, 2, 2, 4, 4)).toBe(true);
  });

  it("blocks when an obstacle is on the path", () => {
    const state = makeGameState();
    setTerrain(state, 3, 2, "obstacle");
    expect(hasLineOfSight(state, 2, 2, 5, 2)).toBe(false);
  });

  it("does not block when impassable is on the path", () => {
    const state = makeGameState();
    setTerrain(state, 3, 2, "impassable");
    expect(hasLineOfSight(state, 2, 2, 5, 2)).toBe(true);
  });

  it("does not block when cover is on the path", () => {
    const state = makeGameState();
    setTerrain(state, 3, 2, "cover");
    expect(hasLineOfSight(state, 2, 2, 5, 2)).toBe(true);
  });

  it("blocks lower target behind an elevation ridge from a lower viewer", () => {
    const state = makeGameState();
    setElevation(state, 2, 2, 0);
    setElevation(state, 3, 2, 2);
    setElevation(state, 4, 2, 0);
    expect(hasLineOfSight(state, 2, 2, 4, 2)).toBe(false);
  });

  it("allows viewer above ridge to see lower target behind it", () => {
    const state = makeGameState();
    setElevation(state, 2, 2, 3);
    setElevation(state, 3, 2, 2);
    setElevation(state, 4, 2, 0);
    expect(hasLineOfSight(state, 2, 2, 4, 2)).toBe(true);
  });

  it("allows rim-adjacent viewer to see into a deep pit", () => {
    const state = makePitState();
    expect(hasLineOfSight(state, 2, 1, 3, 3)).toBe(true);
  });

  it("blocks distant viewer from seeing into a deep pit", () => {
    const state = makePitState();
    expect(hasLineOfSight(state, 0, 1, 3, 3)).toBe(false);
  });

  it("blocks diagonal view over pit rim from outside", () => {
    const state = makePitState();
    expect(hasLineOfSight(state, 0, 0, 3, 3)).toBe(false);
  });

  it("allows viewer in pit to see target on rim above", () => {
    const state = makePitState();
    expect(hasLineOfSight(state, 3, 3, 3, 1)).toBe(true);
  });
});

describe("tilesOnCardinalLine", () => {
  it("lists cardinal tiles between endpoints", () => {
    const tiles = tilesOnCardinalLine(2, 2, 2, 5);
    expect(tiles.map((t) => `${t.x},${t.y}`)).toEqual(["2,3", "2,4", "2,5"]);
  });
});

describe("visibleTileKeys", () => {
  it("returns only in-range tiles with LOS", () => {
    const state = makeGameState();
    setTerrain(state, 3, 2, "obstacle");
    const keys = visibleTileKeys(state, 2, 2, { maxRange: 4 });
    expect(keys.has("4,2")).toBe(false);
    expect(keys.has("2,3")).toBe(true);
    expect(keys.has("6,2")).toBe(false);
  });
});

describe("visibleEnemyIds", () => {
  it("returns enemies on visible tiles", () => {
    const state = makeGameState({ enemies: [{ id: "e1", name: "G", x: 4, y: 2, hp: 5 }] });
    setTerrain(state, 3, 2, "obstacle");
    state.players.push({
      id: "p1",
      name: "P",
      x: 2,
      y: 2,
      hp: 10,
      class: "KOPIS",
    });
    expect(visibleEnemyIds(state, "p1")).toEqual([]);
  });
});

describe("outOfLineOfSightTileKeys", () => {
  it("marks tiles blocked by obstacle as out of sight", () => {
    const state = makeGameState();
    setTerrain(state, 3, 2, "obstacle");
    const keys = outOfLineOfSightTileKeys(state, 2, 2);
    expect(keys.has("4,2")).toBe(true);
    expect(keys.has("2,2")).toBe(false);
    expect(keys.has("2,3")).toBe(false);
  });
});
