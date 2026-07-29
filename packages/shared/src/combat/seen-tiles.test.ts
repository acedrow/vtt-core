import { describe, expect, it } from "vitest";

import { applyActivateMap, applyGmForceMove, normalizeGameState } from "../game.js";
import { createBlankGameMap, tileAt } from "../map.js";
import { makeGameState } from "../test/fixtures.js";
import { recordSeenTilesForPlayer, visibleTileKeys } from "./los.js";

describe("seenTilesByPlayerId", () => {
  it("does not record when enforceSightlines is off", () => {
    const state = makeGameState();
    state.players = [{ id: "p1", x: 2, y: 2, hp: 10 }];
    recordSeenTilesForPlayer(state, "p1");
    expect(state.seenTilesByPlayerId).toBeUndefined();
  });

  it("records current LOS tiles including the standing tile after a move", () => {
    const state = makeGameState();
    state.enforceSightlines = true;
    state.players = [{ id: "p1", x: 1, y: 1, hp: 10 }];

    applyGmForceMove(state, { kind: "player", id: "p1" }, 2, 2);

    const seen = new Set(state.seenTilesByPlayerId?.p1 ?? []);
    expect(seen.has("2,2")).toBe(true);
    for (const key of visibleTileKeys(state, 2, 2)) {
      expect(seen.has(key)).toBe(true);
    }
  });

  it("keeps previously seen tiles after leaving LOS", () => {
    const state = makeGameState();
    state.enforceSightlines = true;
    state.players = [{ id: "p1", x: 0, y: 2, hp: 10 }];
    recordSeenTilesForPlayer(state, "p1");
    const before = new Set(state.seenTilesByPlayerId?.p1 ?? []);
    expect(before.has("5,2")).toBe(true);

    tileAt(state.tiles, 3, 2)!.terrain = ["obstacle"];
    applyGmForceMove(state, { kind: "player", id: "p1" }, 0, 2);

    const after = new Set(state.seenTilesByPlayerId?.p1 ?? []);
    expect(after.has("5,2")).toBe(true);
    expect(visibleTileKeys(state, 0, 2).has("5,2")).toBe(false);
  });

  it("clears seen tiles on map activate and survives normalize round-trip", () => {
    const state = makeGameState();
    state.enforceSightlines = true;
    state.players = [{ id: "p1", x: 2, y: 2, hp: 10 }];
    recordSeenTilesForPlayer(state, "p1");
    expect(state.seenTilesByPlayerId?.p1?.length).toBeGreaterThan(0);

    const cloned = structuredClone(state);
    normalizeGameState(cloned);
    expect(cloned.seenTilesByPlayerId?.p1).toEqual(state.seenTilesByPlayerId?.p1);

    const map = createBlankGameMap("fresh", "Fresh", state.width, state.height, true);
    applyActivateMap(state, map);
    expect(state.seenTilesByPlayerId).toBeUndefined();
  });
});
