import { describe, expect, it } from "vitest";

import { tileAt } from "../map.js";
import { makeGameState } from "../test/fixtures.js";
import { applyDamageToObstaclesInTiles } from "./attack.js";

describe("applyDamageToObstaclesInTiles", () => {
  it("reports dealt damage and destroyed obstacles per tile, deduping repeats", () => {
    const state = makeGameState();
    const tile = tileAt(state.tiles, 1, 1)!;
    tile.terrain = ["obstacle"];
    tile.obstacleHp = 5;
    const other = tileAt(state.tiles, 2, 1)!;
    other.terrain = ["obstacle"];
    other.obstacleHp = 20;

    const hit = applyDamageToObstaclesInTiles(
      state,
      [{ x: 1, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
      10,
    );

    expect(hit).toEqual([
      { x: 1, y: 1, dealt: 5, destroyed: true },
      { x: 2, y: 1, dealt: 10, destroyed: false },
    ]);
    expect(tileAt(state.tiles, 1, 1)!.terrain).not.toContain("obstacle");
    expect(tileAt(state.tiles, 2, 1)!.obstacleHp).toBe(10);
  });

  it("skips non-obstacle tiles", () => {
    const state = makeGameState();
    expect(applyDamageToObstaclesInTiles(state, [{ x: 0, y: 0 }], 5)).toEqual([]);
  });
});
