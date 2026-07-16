import { describe, expect, it } from "vitest";
import { addTestEnemy, addTestPlayer, makeGameState } from "../../../shared/src/test/fixtures.js";
import { tileAt } from "@gaem/shared";
import {
  applyAnnihilationCorridorEndOfTurnDamage,
  applyForceProjection,
  applyHylicCorridor,
  applyHylicRejectionField,
  applyRedirectionCircuits,
  areOrthogonallyConnected,
  clearAnnihilationCorridorTileEffects,
  clearEquipmentTerrainSnapshots,
  collectEquipmentPatternTiles,
  enemyOnAnnihilationCorridor,
  HYLIC_ANNIHILATION_CORRIDOR,
  PROMETHEAN_GRADE_HYLIC_REJECTION_FIELD,
  THOUGHT_GUIDING_REDIRECTION_CIRCUITS,
  TRANSIENT_FORCE_PROJECTION,
  validateForceProjection,
  validateHylicCorridorAction,
  validateHylicRejectionField,
  validateRedirectionCircuits,
} from "./equipment.js";
import { collectAttackTiles, initSabaothCharges, resolveCombatAttackSpec } from "@gaem/shared";

describe("Hylic Annihilation Corridor", () => {
  it("places a 5-tile line at an arbitrary anchor", () => {
    const state = makeGameState({ width: 10, height: 10 });
    const player = addTestPlayer(state, "p1", { x: 0, y: 0 });
    player.equipment = HYLIC_ANNIHILATION_CORRIDOR;
    const anchor = { x: 1, y: 3 };

    expect(validateHylicCorridorAction(state, player, anchor, "e")).toBeNull();
    const tiles = collectEquipmentPatternTiles(state, anchor, player.equipment!, "e");
    expect(tiles).toEqual([
      { x: 1, y: 3 },
      { x: 2, y: 3 },
      { x: 3, y: 3 },
      { x: 4, y: 3 },
      { x: 5, y: 3 },
    ]);

    applyHylicCorridor(state, player, anchor, "e");
    expect(enemyOnAnnihilationCorridor(state, { id: "e1", x: 3, y: 3 })).toBe(true);
    expect(enemyOnAnnihilationCorridor(state, { id: "e2", x: 0, y: 0 })).toBe(false);
  });

  it("rejects placement when the pattern leaves the board", () => {
    const state = makeGameState({ width: 6, height: 6 });
    const player = addTestPlayer(state, "p1");
    player.equipment = HYLIC_ANNIHILATION_CORRIDOR;

    expect(validateHylicCorridorAction(state, player, { x: 4, y: 2 }, "e")).toBe(
      "Pattern out of bounds",
    );
  });

  it("rotates the corridor from its anchor", () => {
    const state = makeGameState({ width: 10, height: 10 });
    const player = addTestPlayer(state, "p1");
    player.equipment = HYLIC_ANNIHILATION_CORRIDOR;
    const anchor = { x: 4, y: 4 };

    const east = collectEquipmentPatternTiles(state, anchor, player.equipment!, "e");
    const north = collectEquipmentPatternTiles(state, anchor, player.equipment!, "n");

    expect(east.some((t) => t.x === 8 && t.y === 4)).toBe(true);
    expect(north.some((t) => t.x === 4 && t.y === 0)).toBe(true);
    expect(east).not.toEqual(north);
  });

  it("damages enemies at end of turn and clears after combat", () => {
    const state = makeGameState({ width: 10, height: 10 });
    const player = addTestPlayer(state, "p1", { x: 2, y: 2 });
    player.equipment = HYLIC_ANNIHILATION_CORRIDOR;
    const enemy = addTestEnemy(state, "e1", 4, 2, { name: "Gorgenaut", hp: 5 });

    applyHylicCorridor(state, player, { x: 2, y: 2 }, "e");
    const msg = applyAnnihilationCorridorEndOfTurnDamage(state, enemy);
    expect(msg).toContain("Annihilation Corridor");
    expect(enemy.hp).toBe(4);

    clearAnnihilationCorridorTileEffects(state);
    expect(enemyOnAnnihilationCorridor(state, enemy)).toBe(false);
  });
});

describe("Promethean-Grade Hylic Rejection Field", () => {
  it("places cover on three connected tiles within range", () => {
    const state = makeGameState({ width: 10, height: 10, combat: { playerCountAtStart: 1, pendingActions: [], pendingReaction: null, pendingClassReaction: null, activeEnemyId: null } });
    const player = addTestPlayer(state, "p1", { x: 5, y: 5 });
    player.equipment = PROMETHEAN_GRADE_HYLIC_REJECTION_FIELD;
    const coverTiles = [
      { x: 6, y: 5 },
      { x: 7, y: 5 },
      { x: 7, y: 6 },
    ];

    expect(areOrthogonallyConnected(coverTiles)).toBe(true);
    expect(validateHylicRejectionField(state, player, coverTiles)).toBeNull();
    applyHylicRejectionField(state, coverTiles);

    for (const tile of coverTiles) {
      expect(tileAt(state.tiles, tile.x, tile.y)?.terrain).toEqual(["cover"]);
    }
    expect(state.combat?.equipmentTerrainSnapshots).toHaveLength(3);
  });

  it("rejects tiles out of range or not connected", () => {
    const state = makeGameState({ width: 10, height: 10 });
    const player = addTestPlayer(state, "p1", { x: 5, y: 5 });
    player.equipment = PROMETHEAN_GRADE_HYLIC_REJECTION_FIELD;

    expect(
      validateHylicRejectionField(state, player, [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ]),
    ).toBe("Tile out of range");

    expect(
      validateHylicRejectionField(state, player, [
        { x: 6, y: 5 },
        { x: 8, y: 5 },
        { x: 7, y: 6 },
      ]),
    ).toBe("Tiles must be connected");
  });

  it("restores terrain snapshots on combat reset", () => {
    const state = makeGameState({
      width: 10,
      height: 10,
      combat: { playerCountAtStart: 1, pendingActions: [], pendingReaction: null, pendingClassReaction: null, activeEnemyId: null },
    });
    const tile = tileAt(state.tiles, 6, 5)!;
    tile.terrain = ["advantageous"];
    applyHylicRejectionField(state, [{ x: 6, y: 5 }, { x: 7, y: 5 }, { x: 7, y: 6 }]);
    // Cover layers onto existing terrain rather than replacing it.
    expect(tile.terrain).toEqual(["advantageous", "cover"]);
    clearEquipmentTerrainSnapshots(state);
    expect(tile.terrain).toEqual(["advantageous"]);
  });
});

describe("Transient Force Projection", () => {
  it("rejects occupied projection squares", () => {
    const state = makeGameState({ width: 10, height: 10 });
    const player = addTestPlayer(state, "p1", { x: 5, y: 5, weapon: "Stain Creep Slayer" });
    player.equipment = TRANSIENT_FORCE_PROJECTION;
    addTestEnemy(state, "e1", 6, 5);

    expect(
      validateForceProjection(state, player, {
        action: "useEquipment",
        projectionX: 6,
        projectionY: 5,
        direction: "n",
      }),
    ).toBe("Square must be empty");
  });

  it("attacks from the projection square and voids it", () => {
    const state = makeGameState({
      width: 10,
      height: 10,
      combat: { playerCountAtStart: 1, pendingActions: [], pendingReaction: null, pendingClassReaction: null, activeEnemyId: null },
    });
    const player = addTestPlayer(state, "p1", { x: 5, y: 5, weapon: "Heaven Burning Sword" });
    player.equipment = TRANSIENT_FORCE_PROJECTION;
    const enemy = addTestEnemy(state, "e1", 8, 5, { name: "Gorgenaut", hp: 30 });

    const action = {
      action: "useEquipment" as const,
      projectionX: 6,
      projectionY: 5,
      direction: "e" as const,
    };
    expect(validateForceProjection(state, player, action)).toBeNull();

    const { hitEnemyIds } = applyForceProjection(state, player, action);
    expect(hitEnemyIds).toContain("e1");
    expect(enemy.hp).toBeLessThan(30);
    expect(tileAt(state.tiles, 6, 5)?.terrain).toEqual(["void"]);
  });
});

describe("Thought-Guiding Redirection Circuits", () => {
  it("redirects a direct adjacent enemy attack", () => {
    const state = makeGameState({ width: 10, height: 10 });
    const player = addTestPlayer(state, "p1", { x: 5, y: 5 });
    player.equipment = THOUGHT_GUIDING_REDIRECTION_CIRCUITS;
    const source = addTestEnemy(state, "e1", 6, 5, { name: "RETIARIUS", hp: 30 });
    const target = addTestEnemy(state, "e2", 7, 5, { name: "Gorgenaut", hp: 30 });

    const action = {
      action: "useEquipment" as const,
      sourceEnemyId: source.id,
      attackIndex: 1,
      targetEnemyId: target.id,
    };
    expect(validateRedirectionCircuits(state, player, action)).toBeNull();

    const { hitEnemyIds, message } = applyRedirectionCircuits(state, player, action);
    expect(hitEnemyIds).toEqual([target.id]);
    expect(target.hp).toBe(20);
    expect(message).toContain("redirected");
  });

  it("redirects a burst pattern attack onto other enemies", () => {
    const state = makeGameState({ width: 10, height: 10 });
    const player = addTestPlayer(state, "p1", { x: 5, y: 5 });
    player.equipment = THOUGHT_GUIDING_REDIRECTION_CIRCUITS;
    const source = addTestEnemy(state, "e1", 6, 5, { name: "Eyesting Rose", hp: 50 });
    const target = addTestEnemy(state, "e2", 7, 5, { name: "Gorgenaut", hp: 50 });

    const action = {
      action: "useEquipment" as const,
      sourceEnemyId: source.id,
      attackIndex: 1,
      direction: "e" as const,
    };
    expect(validateRedirectionCircuits(state, player, action)).toBeNull();

    const { hitEnemyIds } = applyRedirectionCircuits(state, player, action);
    expect(hitEnemyIds).toContain(target.id);
    expect(target.hp).toBe(40);
  });

  it("rejects unsupported spawn attacks", () => {
    const state = makeGameState({ width: 10, height: 10 });
    const player = addTestPlayer(state, "p1", { x: 5, y: 5 });
    player.equipment = THOUGHT_GUIDING_REDIRECTION_CIRCUITS;
    const source = addTestEnemy(state, "e1", 6, 5, { name: "Soaring Bombardier", hp: 10 });

    expect(
      validateRedirectionCircuits(state, player, {
        action: "useEquipment",
        sourceEnemyId: source.id,
        attackIndex: 0,
      }),
    ).toBe("Attack not supported");
  });
});

describe("obliteration charge pattern rotation", () => {
  it("rotates bespoke bomb tiles with direction", () => {
    const state = makeGameState({ width: 12, height: 12 });
    const player = addTestPlayer(state, "p1", { x: 5, y: 5, weapon: "Sabaoth-Class Obliteration Charges" });
    initSabaothCharges(player);
    player.counters!.sabaothBomb = 0;

    const spec = resolveCombatAttackSpec(player, player.weapon)!;
    const east = collectAttackTiles(state, { x: 5, y: 5 }, spec, "e");
    const north = collectAttackTiles(state, { x: 5, y: 5 }, spec, "n");

    expect(east.some((t) => t.x === 8 && t.y === 5)).toBe(true);
    expect(north.some((t) => t.x === 5 && t.y === 2)).toBe(true);
    expect(east).not.toEqual(north);
  });
});
