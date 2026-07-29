import { describe, expect, it } from "vitest";

import { sheetTierMenuItems } from "./sheetTierActions.js";

describe("sheetTierMenuItems", () => {
  it("groups included actions by tier and skips excluded ones", () => {
    expect(
      sheetTierMenuItems([
        { id: "attack", label: "Attack", tier: "main", include: true },
        { id: "rez", label: "Rez", tier: "main", include: false },
        { id: "armor", label: "Armor", tier: "support", include: true, disabled: true },
        { id: "shove", label: "Shove", tier: "aux", include: true },
      ]),
    ).toEqual({
      main: [{ id: "attack", label: "Attack" }],
      support: [{ id: "armor", label: "Armor", disabled: true }],
      aux: [{ id: "shove", label: "Shove" }],
    });
  });
});
