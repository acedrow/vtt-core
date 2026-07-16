import { describe, expect, it } from "vitest";
import {
  baseUnitElevation,
  effectiveElevation,
  initializeUnitElevation,
  isFlyingUnit,
  syncUnitElevationOnTile,
  tickFallingStartOfTurn,
} from "@gaem/shared";
import { hasLineOfSight } from "@gaem/shared";
import { terrainStepCost } from "@gaem/shared";
import { resolveDamageAgainstTarget } from "@gaem/shared";
import { validateAddEnemy, validateEnemyMove } from "@gaem/shared";
import { addTestEnemy, addTestPlayer, makeGameState } from "../fixtures.js";
import { tileAt } from "@gaem/shared";

describe("elevation helpers", () => {
  it("uses tile elevation when unit elevation unset", () => {
    const state = makeGameState();
    tileAt(state.tiles, 2, 2)!.elevation = 2;
    const player = addTestPlayer(state, "p1", { x: 2, y: 2 });
    expect(baseUnitElevation(state, player)).toBe(2);
    expect(effectiveElevation(state, player)).toBe(2);
  });

  it("Aegis grants +1 effective elevation", () => {
    const state = makeGameState();
    const player = addTestPlayer(state, "p1", { x: 2, y: 2, effects: { Aegis: 1 } });
    player.elevation = 1;
    expect(isFlyingUnit(player)).toBe(true);
    expect(effectiveElevation(state, player)).toBe(2);
  });

  it("Flying tag grants +1 effective elevation", () => {
    const state = makeGameState();
    tileAt(state.tiles, 2, 2)!.elevation = 0;
    const enemy = addTestEnemy(state, "e1", 2, 2, { name: "Shadowing Witness" });
    expect(isFlyingUnit(enemy)).toBe(true);
    expect(effectiveElevation(state, enemy)).toBe(1);
  });

  it("sync snaps to higher tile and to lower tile when not Flying", () => {
    const state = makeGameState();
    tileAt(state.tiles, 3, 2)!.elevation = 2;
    const player = addTestPlayer(state, "p1", { x: 2, y: 2 });
    player.elevation = 0;
    syncUnitElevationOnTile(state, player, 3, 2);
    expect(player.elevation).toBe(2);
    tileAt(state.tiles, 4, 2)!.elevation = 0;
    syncUnitElevationOnTile(state, player, 4, 2);
    expect(player.elevation).toBe(0);
  });

  it("charges flat +1 for uphill step", () => {
    const state = makeGameState();
    tileAt(state.tiles, 2, 2)!.elevation = 0;
    tileAt(state.tiles, 3, 2)!.elevation = 2;
    expect(terrainStepCost(state, 2, 2, 3, 2)).toBe(2);
  });

  it("Seeking ignores uphill cost", () => {
    const state = makeGameState();
    tileAt(state.tiles, 3, 2)!.elevation = 2;
    expect(terrainStepCost(state, 2, 2, 3, 2, { seeking: true })).toBe(1);
  });
});

describe("Falling", () => {
  it("begins Falling above elev 1 and deals peak damage on landing", () => {
    const state = makeGameState();
    tileAt(state.tiles, 2, 2)!.elevation = 0;
    const player = addTestPlayer(state, "p1", { x: 2, y: 2, hp: 20, class: "HARPE" });
    player.elevation = 3;
    const first = tickFallingStartOfTurn(state, player, "player");
    expect(first.some((m) => m.includes("began Falling"))).toBe(true);
    expect(player.falling?.peak).toBe(3);
    expect(player.elevation).toBe(2);

    tickFallingStartOfTurn(state, player, "player");
    expect(player.elevation).toBe(1);

    const land = tickFallingStartOfTurn(state, player, "player");
    expect(land.some((m) => m.includes("landed"))).toBe(true);
    expect(player.falling).toBeUndefined();
    expect(player.elevation).toBe(0);
    expect(player.hp).toBe(17);
  });

  it("landing collision damages and pushes the occupant", () => {
    const state = makeGameState();
    tileAt(state.tiles, 2, 2)!.elevation = 0;
    const faller = addTestPlayer(state, "p1", { x: 2, y: 2, hp: 20, class: "HARPE" });
    const occupant = addTestPlayer(state, "p2", { x: 2, y: 2, hp: 20, class: "HARPE" });
    faller.elevation = 2;

    tickFallingStartOfTurn(state, faller, "player");
    expect(faller.elevation).toBe(1);

    const land = tickFallingStartOfTurn(state, faller, "player");
    expect(land.some((m) => m.includes("landing collision"))).toBe(true);
    expect(land.some((m) => m.includes("pushed occupant"))).toBe(true);
    expect(occupant.hp).toBe(18);
    expect(occupant.x !== 2 || occupant.y !== 2).toBe(true);
    expect(faller.falling).toBeUndefined();
    expect(faller.elevation).toBe(0);
  });
});

describe("Flying terrain pass", () => {
  it("allows Flying enemy move onto void tiles", () => {
    const state = makeGameState({ roundPhase: "gmTurn", turn: { role: "gm" } });
    tileAt(state.tiles, 3, 2)!.terrain = ["void"];
    const enemy = addTestEnemy(state, "e1", 2, 2, { name: "Shadowing Witness" });
    enemy.movementRemaining = 2;
    expect(validateEnemyMove(state, "e1", 3, 2)).toBeNull();
  });

  it("allows Flying enemy spawn onto void tiles", () => {
    const state = makeGameState();
    tileAt(state.tiles, 3, 3)!.terrain = ["void"];
    expect(validateAddEnemy(state, 3, 3, 1, "Shadowing Witness")).toBeNull();
    expect(validateAddEnemy(state, 3, 3)).toBe("Blocked");
  });
});

describe("Piercing and Seeking LOS", () => {
  it("Piercing may ignore one obstacle tile", () => {
    const state = makeGameState();
    setObstacle(state, 3, 2);
    expect(hasLineOfSight(state, 2, 2, 5, 2)).toBe(false);
    expect(hasLineOfSight(state, 2, 2, 5, 2, { piercing: 1 })).toBe(true);
  });

  it("Seeking ignores elevation ridge blockers", () => {
    const state = makeGameState();
    tileAt(state.tiles, 2, 2)!.elevation = 0;
    tileAt(state.tiles, 3, 2)!.elevation = 2;
    tileAt(state.tiles, 4, 2)!.elevation = 0;
    expect(hasLineOfSight(state, 2, 2, 4, 2)).toBe(false);
    expect(hasLineOfSight(state, 2, 2, 4, 2, { seeking: true })).toBe(true);
  });

  it("Piercing skips Cover reduction", () => {
    const state = makeGameState();
    tileAt(state.tiles, 3, 2)!.terrain = ["cover"];
    expect(resolveDamageAgainstTarget(5, { x: 3, y: 2 }, { state })).toBe(4);
    expect(resolveDamageAgainstTarget(5, { x: 3, y: 2 }, { state, piercing: true })).toBe(5);
  });
});

describe("initializeUnitElevation", () => {
  it("sets elev from tile on add", () => {
    const state = makeGameState();
    tileAt(state.tiles, 2, 2)!.elevation = 1;
    const player = addTestPlayer(state, "p1", { x: 2, y: 2 });
    initializeUnitElevation(state, player);
    expect(player.elevation).toBe(1);
  });
});

function setObstacle(state: ReturnType<typeof makeGameState>, x: number, y: number) {
  tileAt(state.tiles, x, y)!.terrain = ["obstacle"];
}
