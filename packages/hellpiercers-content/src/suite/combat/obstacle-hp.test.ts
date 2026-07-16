import { describe, expect, it } from "vitest";

import {
  applyAttackToEnemies,
  applyDamageToObstacle,
  applyRangeAttackToEnemies,
} from "@gaem/shared";
import { applyGmApplyDamage, applyGmPaintTile, validateGmApplyDamage } from "@gaem/shared";
import { DEFAULT_OBSTACLE_HP } from "@gaem/shared";
import {
  getObstacleHp,
  isObstacleTile,
  parseGameMap,
  setTileTerrain,
  tileAt,
} from "@gaem/shared";
import { addTestEnemy, addTestPlayer, makeGameState, makeTiles } from "../fixtures.js";
import type { WeaponAttackSpec } from "@gaem/shared";

describe("obstacle HP", () => {
  it("defaults missing obstacleHp to 15 on parse and setTileTerrain", () => {
    const map = parseGameMap({
      id: "obs",
      width: 2,
      height: 1,
      tiles: [
        { x: 0, y: 0, terrain: ["obstacle"], elevation: 0 },
        { x: 1, y: 0, terrain: ["standard"], elevation: 0 },
      ],
    });
    expect(map.tiles[0]!.obstacleHp).toBe(DEFAULT_OBSTACLE_HP);
    expect(map.tiles[1]!.obstacleHp).toBeUndefined();

    const tile = map.tiles[1]!;
    setTileTerrain(tile, "obstacle");
    expect(tile.obstacleHp).toBe(DEFAULT_OBSTACLE_HP);
    setTileTerrain(tile, "standard");
    expect(tile.obstacleHp).toBeUndefined();
  });

  it("paint sets obstacleHp and clears it when leaving obstacle", () => {
    const state = makeGameState();
    applyGmPaintTile(state, 0, 0, { terrain: "obstacle", obstacleHp: 20 });
    const tile = tileAt(state.tiles, 0, 0)!;
    expect(tile.terrain).toEqual(["obstacle"]);
    expect(tile.obstacleHp).toBe(20);

    applyGmPaintTile(state, 0, 0, { terrain: "standard" });
    expect(tile.terrain).toEqual(["standard"]);
    expect(tile.obstacleHp).toBeUndefined();
  });

  it("painting obstacle without HP field defaults to 15", () => {
    const state = makeGameState();
    applyGmPaintTile(state, 1, 1, { terrain: "obstacle" });
    expect(tileAt(state.tiles, 1, 1)!.obstacleHp).toBe(DEFAULT_OBSTACLE_HP);
  });

  it("applyDamageToObstacle reduces HP and converts to standard at 0", () => {
    const state = makeGameState();
    applyGmPaintTile(state, 3, 3, { terrain: "obstacle", obstacleHp: 10 });
    expect(applyDamageToObstacle(state, 3, 3, 4)).toBe(4);
    expect(getObstacleHp(tileAt(state.tiles, 3, 3)!)).toBe(6);
    expect(applyDamageToObstacle(state, 3, 3, 6)).toBe(6);
    const tile = tileAt(state.tiles, 3, 3)!;
    expect(isObstacleTile(tile)).toBe(false);
    expect(tile.terrain).toEqual(["standard"]);
    expect(tile.obstacleHp).toBeUndefined();
  });

  it("legacy obstacle without HP uses 15 effective HP", () => {
    const tiles = makeTiles(4, 4);
    const tile = tileAt(tiles, 2, 2)!;
    tile.terrain = ["obstacle"];
    delete tile.obstacleHp;
    const state = makeGameState({ tiles });
    expect(getObstacleHp(tileAt(state.tiles, 2, 2)!)).toBe(15);
    applyDamageToObstacle(state, 2, 2, 15);
    expect(isObstacleTile(tileAt(state.tiles, 2, 2)!)).toBe(false);
  });

  it("pattern attacks damage obstacles on covered tiles", () => {
    const state = makeGameState();
    addTestPlayer(state, "p1", { x: 2, y: 2 });
    applyGmPaintTile(state, 3, 2, { terrain: "obstacle", obstacleHp: 8 });
    const spec: WeaponAttackSpec = {
      tiles: [[1, 0]],
      damage: "5",
    };
    applyAttackToEnemies(state, spec, { x: 2, y: 2 }, "e");
    expect(getObstacleHp(tileAt(state.tiles, 3, 2)!)).toBe(3);
  });

  it("range attacks can damage selected obstacles", () => {
    const state = makeGameState();
    addTestEnemy(state, "e1", 4, 2, { name: "Gorgenaut", hp: 10 });
    applyGmPaintTile(state, 3, 2, { terrain: "obstacle", obstacleHp: 12 });
    const spec: WeaponAttackSpec = {
      damage: "4",
      rangeTargets: { range: 3, maxTargets: 2 },
    };
    applyRangeAttackToEnemies(state, spec, ["e1"], undefined, {
      obstacleCoords: [{ x: 3, y: 2 }],
    });
    expect(state.enemies[0]!.hp).toBe(6);
    expect(getObstacleHp(tileAt(state.tiles, 3, 2)!)).toBe(8);
  });

  it("gmApplyDamage can target obstacles", () => {
    const state = makeGameState();
    applyGmPaintTile(state, 1, 1, { terrain: "obstacle", obstacleHp: 9 });
    expect(validateGmApplyDamage(state, { kind: "obstacle", x: 1, y: 1 }, 5)).toBeNull();
    applyGmApplyDamage(state, { kind: "obstacle", x: 1, y: 1 }, 5);
    expect(getObstacleHp(tileAt(state.tiles, 1, 1)!)).toBe(4);
    expect(validateGmApplyDamage(state, { kind: "obstacle", x: 0, y: 0 }, 1)).toBe("Not an obstacle");
  });
});
