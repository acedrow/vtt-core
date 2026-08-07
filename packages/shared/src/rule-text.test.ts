import { describe, expect, it } from "vitest";
import { abilityLabel } from "./rule-text.js";

describe("abilityLabel", () => {
  it("returns the text before the em dash for string ability text", () => {
    expect(abilityLabel("Formless — Select an adjacent enemy unit.")).toBe("Formless");
  });

  it("returns the whole string trimmed when there is no em dash", () => {
    expect(abilityLabel("Just a label")).toBe("Just a label");
  });

  it("returns the name for structured ability text", () => {
    expect(abilityLabel({ name: "Blessed Wake", intro: "..." })).toBe("Blessed Wake");
  });

  it("returns null for missing text", () => {
    expect(abilityLabel(undefined)).toBeNull();
    expect(abilityLabel(null)).toBeNull();
  });
});
