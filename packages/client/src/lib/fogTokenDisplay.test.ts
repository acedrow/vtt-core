import { describe, expect, it } from "vitest";

import { fogTokenDisplay } from "./fogTokenDisplay.js";

describe("fogTokenDisplay", () => {
  it("shows tokens normally when sightlines are off or tile is currently visible", () => {
    expect(
      fogTokenDisplay({
        enforceSightlines: false,
        currentlyVisible: false,
        previouslySeen: false,
        rangeFromViewer: 10,
      }),
    ).toBe("visible");
    expect(
      fogTokenDisplay({
        enforceSightlines: true,
        currentlyVisible: true,
        previouslySeen: true,
        rangeFromViewer: 5,
      }),
    ).toBe("visible");
  });

  it("hides tokens on unexplored fog tiles", () => {
    expect(
      fogTokenDisplay({
        enforceSightlines: true,
        currentlyVisible: false,
        previouslySeen: false,
        rangeFromViewer: 1,
      }),
    ).toBe("hidden");
  });

  it("shows ? within range 3 on previously seen tiles and hides farther away", () => {
    expect(
      fogTokenDisplay({
        enforceSightlines: true,
        currentlyVisible: false,
        previouslySeen: true,
        rangeFromViewer: 3,
      }),
    ).toBe("unknown");
    expect(
      fogTokenDisplay({
        enforceSightlines: true,
        currentlyVisible: false,
        previouslySeen: true,
        rangeFromViewer: 4,
      }),
    ).toBe("hidden");
  });

  it("shows a previously seen linked token when another group member is visible", () => {
    expect(
      fogTokenDisplay({
        enforceSightlines: true,
        currentlyVisible: false,
        previouslySeen: true,
        rangeFromViewer: 8,
        linkedVisibleToken: true,
      }),
    ).toBe("unknown");
  });
});
