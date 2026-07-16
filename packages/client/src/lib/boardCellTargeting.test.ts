import { describe, expect, it } from "vitest";

import {
  BOARD_CELL_TARGETING_MODES,
  routesTokenClickToCellTargeting,
} from "./boardCellTargeting.js";

describe("routesTokenClickToCellTargeting", () => {
  it("returns false when no board action mode is active", () => {
    expect(routesTokenClickToCellTargeting(null)).toBe(false);
  });

  it("returns false for gm enemy attack mode", () => {
    expect(routesTokenClickToCellTargeting("gmEnemyAttack")).toBe(false);
  });

  it("returns false during omnistrike bomb selection", () => {
    expect(routesTokenClickToCellTargeting("omnistrike", { omnistrikeStep: "selectBombs" })).toBe(
      false,
    );
  });

  it("routes omnistrike board placement steps", () => {
    expect(routesTokenClickToCellTargeting("omnistrike", { omnistrikeStep: "placeFirst" })).toBe(
      true,
    );
    expect(routesTokenClickToCellTargeting("omnistrike", { omnistrikeStep: "confirm" })).toBe(true);
  });

  it("routes assisted launch so ally tokens match tile clicks", () => {
    expect(routesTokenClickToCellTargeting("assistedLaunch")).toBe(true);
  });

  for (const mode of BOARD_CELL_TARGETING_MODES) {
    it(`routes ${mode} token clicks to cell targeting`, () => {
      expect(routesTokenClickToCellTargeting(mode)).toBe(true);
    });
  }
});
