import { describe, expect, it } from "vitest";

import { canGrantGmPermissions, hasGmCapabilities } from "./auth-capabilities.js";

describe("hasGmCapabilities", () => {
  it("returns true for GM role", () => {
    expect(hasGmCapabilities({ role: "gm" })).toBe(true);
  });

  it("returns true for players with gmPermissions", () => {
    expect(hasGmCapabilities({ role: "player", gmPermissions: true })).toBe(true);
  });

  it("returns false for normal players", () => {
    expect(hasGmCapabilities({ role: "player" })).toBe(false);
    expect(hasGmCapabilities({ role: "player", gmPermissions: false })).toBe(false);
  });
});

describe("canGrantGmPermissions", () => {
  it("is true only for GM role", () => {
    expect(canGrantGmPermissions({ role: "gm" })).toBe(true);
    expect(canGrantGmPermissions({ role: "player", gmPermissions: true })).toBe(false);
  });
});
