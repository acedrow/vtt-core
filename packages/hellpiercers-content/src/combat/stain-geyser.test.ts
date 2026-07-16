import { describe, expect, it } from "vitest";
import { ensureFactionStates } from "@gaem/shared";
import { makeGameState } from "../suite/fixtures.js";
import { stainGeyserAreaSize, stainGeyserBoxTiles } from "./stain-geyser.js";

describe("stainGeyserAreaSize", () => {
  it("defaults to 4x4", () => {
    expect(stainGeyserAreaSize(makeGameState())).toBe(4);
  });

  it("uses 6x6 when Interatomic Dowsing is unlocked", () => {
    const state = makeGameState();
    ensureFactionStates(state);
    state.campaign!.factionStates!.paracletus.unlockedUpgrades = ["Interatomic Dowsing"];
    expect(stainGeyserAreaSize(state)).toBe(6);
  });
});

describe("stainGeyserBoxTiles", () => {
  it("centers on the geyser when hover is the geyser tile", () => {
    const tiles = stainGeyserBoxTiles(5, 5, 5, 5, 4, 20, 20);
    expect(tiles).toHaveLength(16);
    expect(tiles.some((t) => t.x === 5 && t.y === 5)).toBe(true);
    const xs = tiles.map((t) => t.x);
    const ys = tiles.map((t) => t.y);
    expect(Math.min(...xs)).toBe(4);
    expect(Math.max(...xs)).toBe(7);
    expect(Math.min(...ys)).toBe(4);
    expect(Math.max(...ys)).toBe(7);
  });

  it("shifts so hover and geyser share the box", () => {
    // Hover NW of geyser → geyser sits in SE of the 4x4
    const tiles = stainGeyserBoxTiles(5, 5, 2, 2, 4, 20, 20);
    expect(tiles).toHaveLength(16);
    expect(tiles.some((t) => t.x === 5 && t.y === 5)).toBe(true);
    expect(tiles.some((t) => t.x === 2 && t.y === 2)).toBe(true);
    const xs = tiles.map((t) => t.x);
    const ys = tiles.map((t) => t.y);
    expect(Math.min(...xs)).toBe(2);
    expect(Math.max(...xs)).toBe(5);
    expect(Math.min(...ys)).toBe(2);
    expect(Math.max(...ys)).toBe(5);
  });

  it("clamps far hover to a geyser-containing box", () => {
    const tiles = stainGeyserBoxTiles(5, 5, 0, 0, 4, 20, 20);
    expect(tiles.some((t) => t.x === 5 && t.y === 5)).toBe(true);
    expect(tiles).toHaveLength(16);
    const xs = tiles.map((t) => t.x);
    const ys = tiles.map((t) => t.y);
    expect(Math.min(...xs)).toBe(2);
    expect(Math.max(...xs)).toBe(5);
    expect(Math.min(...ys)).toBe(2);
    expect(Math.max(...ys)).toBe(5);
  });

  it("clips to map bounds near the edge", () => {
    const tiles = stainGeyserBoxTiles(0, 0, 0, 0, 4, 10, 10);
    expect(tiles.some((t) => t.x === 0 && t.y === 0)).toBe(true);
    expect(tiles.every((t) => t.x >= 0 && t.y >= 0 && t.x < 10 && t.y < 10)).toBe(true);
    expect(tiles.length).toBeLessThan(16);
  });

  it("supports 6x6", () => {
    const tiles = stainGeyserBoxTiles(5, 5, 5, 5, 6, 20, 20);
    expect(tiles).toHaveLength(36);
    expect(tiles.some((t) => t.x === 5 && t.y === 5)).toBe(true);
  });
});
