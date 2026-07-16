import { describe, expect, it } from "vitest";
import { primaryTerrainTypeForIcon, terrainTypeIcon } from "@gaem/shared";
import { TERRAIN_TYPES } from "@gaem/shared";

describe("terrain-data", () => {
  it("includes advantageous in TERRAIN_TYPES", () => {
    expect(TERRAIN_TYPES).toContain("advantageous");
  });

  it("exposes rulebook icons for terrain types", () => {
    expect(terrainTypeIcon("standard")).toBeUndefined();
    expect(terrainTypeIcon("void")).toBeTruthy();
    expect(terrainTypeIcon("impassable")).toBeTruthy();
    expect(terrainTypeIcon("uneasy")).toBeTruthy();
    expect(terrainTypeIcon("cover")).toBeTruthy();
    expect(terrainTypeIcon("obstacle")).toBeTruthy();
    expect(terrainTypeIcon("advantageous")).toBeTruthy();
  });

  it("primaryTerrainTypeForIcon prefers void over other terrain", () => {
    expect(primaryTerrainTypeForIcon(["void"])).toBe("void");
    expect(primaryTerrainTypeForIcon(["standard"])).toBeNull();
    expect(primaryTerrainTypeForIcon(["advantageous"])).toBe("advantageous");
    expect(primaryTerrainTypeForIcon(["cover", "void"])).toBe("void");
    expect(primaryTerrainTypeForIcon(["cover", "uneasy"])).toBe("cover");
  });
});
