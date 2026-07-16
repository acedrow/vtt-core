import { describe, expect, it } from "vitest";

import { applyGmPaintTile, handleCombatMessage, validateGmPaintTile } from "@gaem/shared";
import { tileAt } from "@gaem/shared";
import { makeGameState, makeTiles } from "./fixtures.js";

describe("gmPaintTile", () => {
  it("sets elevation, terrain, and tile effects", () => {
    const state = makeGameState();
    const fields = {
      elevation: 1,
      terrain: "cover" as const,
      tileEffects: ["Stained:2"],
      tileName: "",
      baseColor: null,
      appearanceKey: null,
    };
    expect(validateGmPaintTile(state, 2, 3, fields)).toBeNull();
    applyGmPaintTile(state, 2, 3, fields);
    const tile = tileAt(state.tiles, 2, 3)!;
    expect(tile.elevation).toBe(1);
    expect(tile.terrain).toEqual(["cover"]);
    expect(tile.tileEffects).toEqual({ Stained: 2 });
  });

  it("sets cosmetic tile fields", () => {
    const state = makeGameState();
    applyGmPaintTile(state, 1, 1, {
      elevation: 0,
      terrain: "standard",
      tileEffects: [],
      tileName: "Forest",
      baseColor: "#aabbcc",
      appearanceKey: "tile-appearances/abc.png",
      overlayKey: "tiles/overlays/stain/stain/1.png",
      featureKey: "tiles/features/base/rock.png",
      appearanceTint: { color: "#ff0000", opacity: 0.5 },
      overlayTint: { color: "#0000ff", opacity: 0.2 },
      featureTint: { color: "#00ff00", opacity: 0.3 },
      appearanceRotation: 90,
      appearanceFlip: true,
      overlayRotation: 270,
      overlayFlip: true,
      featureRotation: 180,
      featureFlip: true,
    });
    const tile = tileAt(state.tiles, 1, 1)!;
    expect(tile.name).toBe("Forest");
    expect(tile.baseColor).toBe("#aabbcc");
    expect(tile.appearanceKey).toBe("tile-appearances/abc.png");
    expect(tile.overlayKey).toBe("tiles/overlays/stain/stain/1.png");
    expect(tile.featureKey).toBe("tiles/features/base/rock.png");
    expect(tile.appearanceTint).toEqual({ color: "#ff0000", opacity: 0.5 });
    expect(tile.overlayTint).toEqual({ color: "#0000ff", opacity: 0.2 });
    expect(tile.featureTint).toEqual({ color: "#00ff00", opacity: 0.3 });
    expect(tile.appearanceRotation).toBe(90);
    expect(tile.appearanceFlip).toBe(true);
    expect(tile.overlayRotation).toBe(270);
    expect(tile.overlayFlip).toBe(true);
    expect(tile.featureRotation).toBe(180);
    expect(tile.featureFlip).toBe(true);
  });

  it("clears cosmetic tile fields", () => {
    const state = makeGameState();
    applyGmPaintTile(state, 0, 0, {
      elevation: 0,
      terrain: "standard",
      tileEffects: [],
      tileName: "Named",
      baseColor: "#fff",
      appearanceKey: "key",
      overlayKey: "overlay-key",
      featureKey: "feature-key",
      appearanceTint: { color: "#ff0000", opacity: 0.5 },
      overlayTint: { color: "#00aaff", opacity: 0.4 },
      featureTint: { color: "#00ff00", opacity: 0.5 },
      appearanceRotation: 180,
      appearanceFlip: true,
      overlayRotation: 90,
      overlayFlip: true,
      featureRotation: 90,
      featureFlip: true,
    });
    applyGmPaintTile(state, 0, 0, {
      elevation: 0,
      terrain: "standard",
      tileEffects: [],
      tileName: "",
      baseColor: null,
      appearanceKey: null,
      overlayKey: null,
      featureKey: null,
      appearanceTint: null,
      overlayTint: null,
      featureTint: null,
      appearanceRotation: null,
      appearanceFlip: null,
      overlayRotation: null,
      overlayFlip: null,
      featureRotation: null,
      featureFlip: null,
    });
    const tile = tileAt(state.tiles, 0, 0)!;
    expect(tile.name).toBeUndefined();
    expect(tile.baseColor).toBeUndefined();
    expect(tile.appearanceKey).toBeUndefined();
    expect(tile.overlayKey).toBeUndefined();
    expect(tile.featureKey).toBeUndefined();
    expect(tile.appearanceTint).toBeUndefined();
    expect(tile.overlayTint).toBeUndefined();
    expect(tile.featureTint).toBeUndefined();
    expect(tile.appearanceRotation).toBeUndefined();
    expect(tile.appearanceFlip).toBeUndefined();
    expect(tile.overlayRotation).toBeUndefined();
    expect(tile.overlayFlip).toBeUndefined();
    expect(tile.featureRotation).toBeUndefined();
    expect(tile.featureFlip).toBeUndefined();
  });

  it("replaces existing tile effects", () => {
    const state = makeGameState();
    applyGmPaintTile(state, 1, 1, {
      elevation: 0,
      terrain: "standard",
      tileEffects: ["Fortified:1"],
      tileName: "",
      baseColor: null,
      appearanceKey: null,
    });
    applyGmPaintTile(state, 1, 1, {
      elevation: 0,
      terrain: "standard",
      tileEffects: ["Stained:1"],
      tileName: "",
      baseColor: null,
      appearanceKey: null,
    });
    const tile = tileAt(state.tiles, 1, 1)!;
    expect(tile.tileEffects).toEqual({ Stained: 1 });
  });

  it("clears tile effects with an empty list", () => {
    const state = makeGameState();
    applyGmPaintTile(state, 0, 0, {
      elevation: 0,
      terrain: "standard",
      tileEffects: ["Fortified:1"],
      tileName: "",
      baseColor: null,
      appearanceKey: null,
    });
    const clearFields = {
      elevation: 0,
      terrain: "standard" as const,
      tileEffects: [] as string[],
      tileName: "",
      baseColor: null,
      appearanceKey: null,
    };
    expect(validateGmPaintTile(state, 0, 0, clearFields)).toBeNull();
    applyGmPaintTile(state, 0, 0, clearFields);
    expect(tileAt(state.tiles, 0, 0)!.tileEffects).toBeUndefined();
  });

  it("rejects invalid input", () => {
    const state = makeGameState({ width: 4, height: 4, tiles: makeTiles(4, 4) });
    expect(
      validateGmPaintTile(state, 9, 0, {
        elevation: 0,
        terrain: "standard",
        tileEffects: [],
        tileName: "",
        baseColor: null,
        appearanceKey: null,
      }),
    ).toBe("Out of bounds");
    expect(
      validateGmPaintTile(state, 0, 0, {
        elevation: 4,
        terrain: "standard",
        tileEffects: [],
        tileName: "",
        baseColor: null,
        appearanceKey: null,
      }),
    ).toBe("Elevation must be an integer from -3 to 3");
    expect(
      validateGmPaintTile(state, 0, 0, {
        elevation: 0,
        terrain: "bogus" as never,
        tileEffects: [],
        tileName: "",
        baseColor: null,
        appearanceKey: null,
      }),
    ).toBe("Invalid terrain type: bogus");
    expect(
      validateGmPaintTile(state, 0, 0, {
        elevation: 0,
        terrain: "standard",
        tileEffects: ["Nope:1"],
        tileName: "",
        baseColor: null,
        appearanceKey: null,
      }),
    ).toBe("Unknown effect: Nope");
    expect(
      validateGmPaintTile(state, 0, 0, {
        elevation: 0,
        terrain: "standard",
        tileEffects: [],
        tileName: "",
        baseColor: "not-a-color",
        appearanceKey: null,
      }),
    ).toBe("baseColor must be a #RGB or #RRGGBB hex color");
    expect(
      validateGmPaintTile(state, 0, 0, {
        appearanceTint: { color: "red", opacity: 0.5 },
      }),
    ).toBe("appearanceTint must be { color: #RGB|#RRGGBB, opacity: 0–1 }");
    expect(
      validateGmPaintTile(state, 0, 0, {
        featureTint: { color: "#ff0000", opacity: 1.5 },
      }),
    ).toBe("featureTint must be { color: #RGB|#RRGGBB, opacity: 0–1 }");
  });

  it("leaves omitted fields unchanged", () => {
    const state = makeGameState();
    applyGmPaintTile(state, 1, 1, {
      elevation: 2,
      terrain: "cover",
      tileEffects: ["Fortified:1"],
      tileName: "Keep",
      baseColor: "#112233",
      appearanceKey: "keep.png",
      featureKey: "feature.png",
      appearanceTint: { color: "#ff0000", opacity: 0.4 },
      featureTint: { color: "#0000ff", opacity: 0.6 },
      appearanceRotation: 270,
      appearanceFlip: true,
      featureRotation: 90,
      featureFlip: true,
    });
    applyGmPaintTile(state, 1, 1, { terrain: "obstacle" });
    const tile = tileAt(state.tiles, 1, 1)!;
    expect(tile.elevation).toBe(2);
    expect(tile.terrain).toEqual(["obstacle"]);
    expect(tile.obstacleHp).toBe(15);
    expect(tile.tileEffects).toEqual({ Fortified: 1 });
    expect(tile.name).toBe("Keep");
    expect(tile.baseColor).toBe("#112233");
    expect(tile.appearanceKey).toBe("keep.png");
    expect(tile.featureKey).toBe("feature.png");
    expect(tile.appearanceTint).toEqual({ color: "#ff0000", opacity: 0.4 });
    expect(tile.featureTint).toEqual({ color: "#0000ff", opacity: 0.6 });
    expect(tile.appearanceRotation).toBe(270);
    expect(tile.appearanceFlip).toBe(true);
    expect(tile.featureRotation).toBe(90);
    expect(tile.featureFlip).toBe(true);
  });

  it("appearance-only rotation leaves feature transform unchanged", () => {
    const state = makeGameState();
    applyGmPaintTile(state, 0, 0, {
      appearanceKey: "a.png",
      featureKey: "f.png",
      appearanceRotation: 90,
      featureRotation: 180,
      appearanceFlip: true,
      featureFlip: true,
    });
    applyGmPaintTile(state, 0, 0, {
      appearanceKey: "b.png",
      appearanceRotation: 270,
      appearanceFlip: null,
    });
    const tile = tileAt(state.tiles, 0, 0)!;
    expect(tile.appearanceKey).toBe("b.png");
    expect(tile.appearanceRotation).toBe(270);
    expect(tile.appearanceFlip).toBeUndefined();
    expect(tile.featureKey).toBe("f.png");
    expect(tile.featureRotation).toBe(180);
    expect(tile.featureFlip).toBe(true);
  });

  it("feature-only rotation leaves appearance transform unchanged", () => {
    const state = makeGameState();
    applyGmPaintTile(state, 0, 0, {
      appearanceKey: "a.png",
      featureKey: "f.png",
      appearanceRotation: 90,
      featureRotation: 180,
    });
    applyGmPaintTile(state, 0, 0, {
      featureKey: "g.png",
      featureRotation: 270,
    });
    const tile = tileAt(state.tiles, 0, 0)!;
    expect(tile.appearanceKey).toBe("a.png");
    expect(tile.appearanceRotation).toBe(90);
    expect(tile.featureKey).toBe("g.png");
    expect(tile.featureRotation).toBe(270);
  });

  it("rejects a message with no paint fields", () => {
    const state = makeGameState();
    expect(validateGmPaintTile(state, 0, 0, {})).toBe("No paint fields provided");
    const result = handleCombatMessage(
      state,
      { type: "gmPaintTile", coords: [{ x: 0, y: 0 }] },
      { role: "gm", playerId: null },
    );
    expect(result).toEqual({ handled: true, error: "No paint fields provided" });
  });

  it("paints every coordinate in a batched gmPaintTile message", () => {
    const state = makeGameState({ width: 4, height: 4, tiles: makeTiles(4, 4) });
    const result = handleCombatMessage(
      state,
      {
        type: "gmPaintTile",
        coords: [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }],
        elevation: 2,
        terrain: "cover",
        tileEffects: ["Stained:1"],
        tileName: "",
        baseColor: null,
        appearanceKey: null,
      },
      { role: "gm", playerId: null },
    );
    expect(result).toEqual({ handled: true, message: "", silent: true });
    for (const { x, y } of [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }]) {
      const tile = tileAt(state.tiles, x, y)!;
      expect(tile.elevation).toBe(2);
      expect(tile.terrain).toEqual(["cover"]);
      expect(tile.tileEffects).toEqual({ Stained: 1 });
    }
  });

  it("applies none of a batch if any coordinate fails validation", () => {
    const state = makeGameState({ width: 4, height: 4, tiles: makeTiles(4, 4) });
    const result = handleCombatMessage(
      state,
      {
        type: "gmPaintTile",
        coords: [{ x: 0, y: 0 }, { x: 9, y: 9 }],
        elevation: 1,
        terrain: "cover",
        tileEffects: [],
        tileName: "",
        baseColor: null,
        appearanceKey: null,
      },
      { role: "gm", playerId: null },
    );
    expect(result).toEqual({ handled: true, error: "Out of bounds" });
    expect(tileAt(state.tiles, 0, 0)!.terrain).toEqual(["standard"]);
  });

  it("rejects an empty coords list", () => {
    const state = makeGameState({ width: 4, height: 4, tiles: makeTiles(4, 4) });
    const result = handleCombatMessage(
      state,
      {
        type: "gmPaintTile",
        coords: [],
        elevation: 0,
        terrain: "standard",
        tileEffects: [],
        tileName: "",
        baseColor: null,
        appearanceKey: null,
      },
      { role: "gm", playerId: null },
    );
    expect(result).toEqual({ handled: true, error: "No tiles selected" });
  });
});
