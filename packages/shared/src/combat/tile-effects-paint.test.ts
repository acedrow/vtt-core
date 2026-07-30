import { describe, expect, it } from "vitest";

import { applyGmPaintTile } from "./messages.js";
import { upsertTileEffectStacks } from "./effects.js";
import { tileAt } from "../map.js";
import { makeGameState } from "../test/fixtures.js";
import type { MapTile } from "../types.js";

describe("upsertTileEffectStacks", () => {
  it("adds a second effect without wiping the first and preserves addition order", () => {
    const tile: MapTile = { x: 0, y: 0, terrain: ["standard"], elevation: 0 };
    upsertTileEffectStacks(tile, ["Fortified:1"]);
    upsertTileEffectStacks(tile, ["Stained:2"]);
    expect(Object.keys(tile.tileEffects ?? {})).toEqual(["Fortified", "Stained"]);
    expect(tile.tileEffects).toEqual({ Fortified: 1, Stained: 2 });
  });

  it("updates stacks for an existing id in place", () => {
    const tile: MapTile = { x: 0, y: 0, terrain: ["standard"], elevation: 0 };
    upsertTileEffectStacks(tile, ["Fortified:1"]);
    upsertTileEffectStacks(tile, ["Stained:1"]);
    upsertTileEffectStacks(tile, ["Fortified:3"]);
    expect(Object.keys(tile.tileEffects ?? {})).toEqual(["Fortified", "Stained"]);
    expect(tile.tileEffects?.Fortified).toBe(3);
  });

  it("clears all effects with an empty token list", () => {
    const tile: MapTile = {
      x: 0,
      y: 0,
      terrain: ["standard"],
      elevation: 0,
      tileEffects: { Fortified: 1, Stained: 1 },
    };
    upsertTileEffectStacks(tile, []);
    expect(tile.tileEffects).toBeUndefined();
  });
});

describe("gmPaintTile multi-effect", () => {
  it("paints a second distinct effect without wiping the first", () => {
    const state = makeGameState();
    applyGmPaintTile(state, 1, 1, { tileEffects: ["Fortified:1"] });
    applyGmPaintTile(state, 1, 1, { tileEffects: ["Stained:1"] });
    const tile = tileAt(state.tiles, 1, 1)!;
    expect(Object.keys(tile.tileEffects ?? {})).toEqual(["Fortified", "Stained"]);
    expect(tile.tileEffects).toEqual({ Fortified: 1, Stained: 1 });
  });
});
