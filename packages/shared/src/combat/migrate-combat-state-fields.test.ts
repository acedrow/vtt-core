import { describe, expect, it } from "vitest";
import {
  createDefaultCombatState,
  migrateAttackPreviewFields,
  migrateCombatStateFields,
  type AttackPreviewState,
  type CombatState,
} from "./types.js";

describe("migrateCombatStateFields", () => {
  it("lifts kopisMarks/chrysaorBrands into marks/brands and deletes legacy keys", () => {
    const combat = createDefaultCombatState(1) as CombatState & {
      kopisMarks?: Record<string, string>;
      chrysaorBrands?: Record<string, string>;
    };
    combat.kopisMarks = { p1: "e1" };
    combat.chrysaorBrands = { e1: "p1" };
    delete combat.marks;
    delete combat.brands;

    migrateCombatStateFields(combat);

    expect(combat.marks).toEqual({ p1: "e1" });
    expect(combat.brands).toEqual({ e1: "p1" });
    expect(combat.kopisMarks).toBeUndefined();
    expect(combat.chrysaorBrands).toBeUndefined();
  });

  it("lifts swarmChipResolvedIds into pack and deletes first-class key", () => {
    const combat = createDefaultCombatState(1) as CombatState & {
      swarmChipResolvedIds?: string[];
    };
    combat.swarmChipResolvedIds = ["swarm-a"];
    combat.pack = {};

    migrateCombatStateFields(combat);

    expect(combat.pack?.swarmChipResolvedIds).toEqual(["swarm-a"]);
    expect(combat.swarmChipResolvedIds).toBeUndefined();
  });

  it("prefers existing pack.swarmChipResolvedIds when both present", () => {
    const combat = createDefaultCombatState(1) as CombatState & {
      swarmChipResolvedIds?: string[];
    };
    combat.swarmChipResolvedIds = ["legacy"];
    combat.pack = { swarmChipResolvedIds: ["pack"] };

    migrateCombatStateFields(combat);

    expect(combat.pack?.swarmChipResolvedIds).toEqual(["pack"]);
    expect(combat.swarmChipResolvedIds).toBeUndefined();
  });

  it("defaults pack.swarmChipResolvedIds to [] when missing", () => {
    const combat = createDefaultCombatState(1);
    combat.pack = {};

    migrateCombatStateFields(combat);

    expect(combat.pack?.swarmChipResolvedIds).toEqual([]);
  });
});

describe("migrateAttackPreviewFields", () => {
  it("lifts omnistrike fields into pack and deletes top-level keys", () => {
    const preview = {
      mode: "omnistrike",
      omnistrikeStep: "placeFirst",
      omnistrikeBombIndices: [0, 1],
      omnistrikeAnchors: [{ x: 1, y: 2 }, null],
    } as AttackPreviewState & {
      omnistrikeStep?: string;
      omnistrikeBombIndices?: [number, number];
      omnistrikeAnchors?: [{ x: number; y: number } | null, { x: number; y: number } | null];
    };

    migrateAttackPreviewFields(preview);

    expect(preview.pack).toEqual({
      omnistrikeStep: "placeFirst",
      omnistrikeBombIndices: [0, 1],
      omnistrikeAnchors: [{ x: 1, y: 2 }, null],
    });
    expect(preview.omnistrikeStep).toBeUndefined();
    expect(preview.omnistrikeBombIndices).toBeUndefined();
    expect(preview.omnistrikeAnchors).toBeUndefined();
  });

  it("prefers existing pack omnistrike keys when both present", () => {
    const preview = {
      mode: "omnistrike",
      omnistrikeStep: "placeFirst",
      pack: { omnistrikeStep: "confirm" },
    } as AttackPreviewState & { omnistrikeStep?: string };

    migrateAttackPreviewFields(preview);

    expect(preview.pack?.omnistrikeStep).toBe("confirm");
    expect(preview.omnistrikeStep).toBeUndefined();
  });
});
