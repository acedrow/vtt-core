import { describe, expect, it } from "vitest";
import { normalizePlayerAction } from "./normalize-player-action.js";

describe("normalizePlayerAction", () => {
  it("maps assistedLaunch to pack", () => {
    expect(normalizePlayerAction({ action: "assistedLaunch", anchorX: 1, anchorY: 2 })).toEqual({
      action: "pack",
      kind: "assistedLaunch",
      detail: { anchorX: 1, anchorY: 2 },
    });
  });

  it("maps armorAction fields into detail", () => {
    expect(
      normalizePlayerAction({
        action: "armorAction",
        kind: "tower_teleport",
        x: 3,
        y: 4,
        keraunoTargetEnemyId: "e1",
      }),
    ).toEqual({
      action: "pack",
      kind: "armorAction",
      detail: {
        kind: "tower_teleport",
        x: 3,
        y: 4,
        keraunoTargetEnemyId: "e1",
      },
    });
  });

  it("maps classActive fields into detail", () => {
    expect(
      normalizePlayerAction({
        action: "classActive",
        kind: "mag_dump",
        targetEnemyIds: ["e1"],
        harpeRecall: true,
        harpeEquipWeapon: "Kopis",
      }),
    ).toEqual({
      action: "pack",
      kind: "classActive",
      detail: {
        kind: "mag_dump",
        targetEnemyIds: ["e1"],
        harpeRecall: true,
        harpeEquipWeapon: "Kopis",
      },
    });
  });

  it("maps classPassive to pack", () => {
    expect(
      normalizePlayerAction({
        action: "classPassive",
        kind: "baseline_communism",
        targetPlayerId: "p2",
      }),
    ).toEqual({
      action: "pack",
      kind: "classPassive",
      detail: { kind: "baseline_communism", targetPlayerId: "p2" },
    });
  });

  it("maps weaponActive omnistrike/warhook under detail", () => {
    const omnistrike = {
      bombIndices: [0, 1] as [number, number],
      anchors: [
        { x: 1, y: 1 },
        { x: 2, y: 2 },
      ] as [{ x: number; y: number }, { x: number; y: number }],
      direction: "e" as const,
    };
    expect(
      normalizePlayerAction({
        action: "weaponActive",
        detail: "heaven_burning_unfold",
        omnistrike,
        warhook: {
          targetX: 5,
          targetY: 5,
          landingX: 4,
          landingY: 5,
        },
      }),
    ).toEqual({
      action: "pack",
      kind: "weaponActive",
      detail: {
        detail: "heaven_burning_unfold",
        omnistrike,
        warhook: {
          targetX: 5,
          targetY: 5,
          landingX: 4,
          landingY: 5,
        },
      },
    });
  });

  it("passes through pack and engine-owned actions", () => {
    expect(normalizePlayerAction({ action: "pack", kind: "classActive", detail: { kind: "mag_dump" } })).toEqual({
      action: "pack",
      kind: "classActive",
      detail: { kind: "mag_dump" },
    });
    expect(normalizePlayerAction({ action: "sprint" })).toEqual({ action: "sprint" });
    expect(normalizePlayerAction({ action: "commitHaste", tier: "main" })).toEqual({
      action: "commitHaste",
      tier: "main",
    });
  });

  it("rejects invalid payloads", () => {
    expect(normalizePlayerAction(null)).toEqual({ error: "Invalid player action" });
    expect(normalizePlayerAction({ action: "nope" })).toEqual({ error: "Unknown player action: nope" });
    expect(normalizePlayerAction({ action: "pack" })).toEqual({ error: "Invalid pack action" });
    expect(normalizePlayerAction({ action: "pack", kind: "x", detail: 1 })).toEqual({
      error: "Invalid pack action detail",
    });
  });
});
