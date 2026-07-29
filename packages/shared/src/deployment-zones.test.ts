import { describe, expect, it } from "vitest";

import { applyGmPaintTile } from "./combat/messages.js";
import { persistMapTileFromState, tileAt } from "./map.js";
import type { GameMap, GameState, MapTile } from "./types.js";

function makeTile(x: number, y: number, extras: Partial<MapTile> = {}): MapTile {
  return { x, y, terrain: ["standard"], elevation: 0, ...extras };
}

function makeState(tiles: MapTile[]): GameState {
  return {
    width: 2,
    height: 2,
    tiles,
    players: [],
    enemies: [],
    roundPhase: "deployment",
  } as GameState;
}

function makeMap(tiles: MapTile[]): GameMap {
  return {
    id: "test",
    width: 2,
    height: 2,
    tiles: tiles.map((t) => ({ ...t, terrain: [...t.terrain] })),
  };
}

describe("deployment zones", () => {
  it("paints and clears deploymentZone on live tiles", () => {
    const state = makeState([makeTile(0, 0), makeTile(1, 0)]);
    applyGmPaintTile(state, 0, 0, { deploymentZone: true });
    expect(tileAt(state.tiles, 0, 0)?.deploymentZone).toBe(true);

    applyGmPaintTile(state, 0, 0, { deploymentZone: false });
    expect(tileAt(state.tiles, 0, 0)?.deploymentZone).toBeUndefined();
  });

  it("persists deploymentZone onto the saved map tile", () => {
    const stateTile = makeTile(0, 0, { deploymentZone: true });
    const map = makeMap([makeTile(0, 0)]);
    persistMapTileFromState(map, stateTile);
    expect(tileAt(map.tiles, 0, 0)?.deploymentZone).toBe(true);

    persistMapTileFromState(map, makeTile(0, 0));
    expect(tileAt(map.tiles, 0, 0)?.deploymentZone).toBeUndefined();
  });
});
