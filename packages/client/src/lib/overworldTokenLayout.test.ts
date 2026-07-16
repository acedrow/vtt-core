import { describe, expect, it } from "vitest";

import {
  applyStackSpread,
  orderOccupants,
  slotForOccupant,
  stackSlotFractions,
  stackSpreadFromZoom,
} from "./overworldTokenLayout.js";

describe("stackSlotFractions", () => {
  it("centers a single token", () => {
    expect(stackSlotFractions(1)).toEqual([{ fx: 0.5, fy: 0.5 }]);
  });

  it("uses a diagonal for two tokens", () => {
    expect(stackSlotFractions(2)).toEqual([
      { fx: 0.25, fy: 0.25 },
      { fx: 0.75, fy: 0.75 },
    ]);
  });

  it("uses a triangle for three tokens", () => {
    expect(stackSlotFractions(3)).toEqual([
      { fx: 0.5, fy: 0.25 },
      { fx: 0.25, fy: 0.75 },
      { fx: 0.75, fy: 0.75 },
    ]);
  });

  it("uses four corners for four tokens", () => {
    expect(stackSlotFractions(4)).toEqual([
      { fx: 0.25, fy: 0.25 },
      { fx: 0.75, fy: 0.25 },
      { fx: 0.25, fy: 0.75 },
      { fx: 0.75, fy: 0.75 },
    ]);
  });

  it("places extras at center beyond four", () => {
    const slots = stackSlotFractions(5);
    expect(slots).toHaveLength(5);
    expect(slots.slice(0, 4)).toEqual(stackSlotFractions(4));
    expect(slots[4]).toEqual({ fx: 0.5, fy: 0.5 });
  });
});

describe("slotForOccupant", () => {
  it("orders location, then convoys by id, then party", () => {
    expect(
      orderOccupants([
        { kind: "party" },
        { kind: "convoy", id: "c-b" },
        { kind: "location", id: "loc" },
        { kind: "convoy", id: "c-a" },
      ]),
    ).toEqual([
      { kind: "location", id: "loc" },
      { kind: "convoy", id: "c-a" },
      { kind: "convoy", id: "c-b" },
      { kind: "party" },
    ]);
  });

  it("assigns stable slots for location+convoy", () => {
    const occupants = [
      { kind: "location" as const, id: "loc" },
      { kind: "convoy" as const, id: "c-1" },
    ];
    expect(slotForOccupant(occupants, occupants[0]!)).toEqual({ fx: 0.25, fy: 0.25 });
    expect(slotForOccupant(occupants, occupants[1]!)).toEqual({ fx: 0.75, fy: 0.75 });
  });

  it("gives each stacked convoy its own slot", () => {
    const occupants = [
      { kind: "convoy" as const, id: "c-1" },
      { kind: "convoy" as const, id: "c-2" },
    ];
    expect(slotForOccupant(occupants, occupants[0]!)).toEqual({ fx: 0.25, fy: 0.25 });
    expect(slotForOccupant(occupants, occupants[1]!)).toEqual({ fx: 0.75, fy: 0.75 });
  });
});

describe("stackSpreadFromZoom", () => {
  it("is slightly above 1 at fit, a bit larger when zoomed in, larger when zoomed out", () => {
    expect(stackSpreadFromZoom(0.5, 0.5)).toBeCloseTo(1.2);
    expect(stackSpreadFromZoom(0.5, 2)).toBeCloseTo(1.3);
    expect(stackSpreadFromZoom(0.5, 0.5 * 0.65)).toBeCloseTo(2.0);
  });

  it("scales slot offset from center", () => {
    expect(applyStackSpread({ fx: 0.25, fy: 0.25 }, 2)).toEqual({ fx: 0, fy: 0 });
    expect(applyStackSpread({ fx: 0.75, fy: 0.75 }, 0.5)).toEqual({ fx: 0.625, fy: 0.625 });
  });
});
