import { describe, expect, it } from "vitest";
import {
  addEnemy,
  addPlayer,
  applyEnemyMove,
  applyMove,
  buildBoardOccupancy,
  canSetPlayerHp,
  clampHp,
  findSpawn,
  isTileOccupied,
  removeEnemy,
  setPlayerHp,
  spawnPlayerFromSheet,
  validateAddEnemy,
  validateEnemyMove,
  validateMove,
} from "@gaem/shared";
import { coordKey } from "@gaem/shared";
import { addTestEnemy, addTestPlayer, makeGameState, makeTiles } from "./fixtures.js";

describe("game", () => {
  describe("occupancy", () => {
    it("tracks players and enemy footprints", () => {
      const state = makeGameState();
      addTestPlayer(state, "p1", { x: 2, y: 2 });
      addTestEnemy(state, "e1", 4, 4);
      addTestEnemy(state, "e2", 5, 5, { scale: 2 });

      const occ = buildBoardOccupancy(state);
      expect(occ.playerByKey.get(coordKey(2, 2))?.id).toBe("p1");
      expect(occ.enemyByKey.get(coordKey(4, 4))?.id).toBe("e1");
      expect(occ.enemiesByKey.get(coordKey(4, 4))?.map((e) => e.id)).toEqual(["e1"]);
      expect(occ.enemyByKey.get(coordKey(5, 5))?.id).toBe("e2");
      expect(occ.enemyByKey.get(coordKey(6, 6))?.id).toBe("e2");

      expect(isTileOccupied(state, 2, 2)).toBe(true);
      expect(isTileOccupied(state, 6, 6)).toBe(true);
      expect(isTileOccupied(state, 1, 1)).toBe(false);
    });

    it("lists every stacked enemy on a shared tile", () => {
      const state = makeGameState();
      addTestEnemy(state, "e1", 4, 4, { name: "Latent Pudding" });
      addTestEnemy(state, "e2", 4, 4, { name: "Latent Pudding" });

      const occ = buildBoardOccupancy(state);
      expect(occ.enemiesByKey.get(coordKey(4, 4))?.map((e) => e.id).sort()).toEqual(["e1", "e2"]);
      expect(occ.enemyByKey.has(coordKey(4, 4))).toBe(true);
    });
  });

  describe("validateMove / applyMove", () => {
    it("rejects invalid moves during deployment", () => {
      const state = makeGameState({ roundPhase: "deployment" });
      addTestPlayer(state, "p1", { x: 2, y: 2 });

      expect(validateMove(state, "p1", 9, 2)).toBe("Out of bounds");
      expect(validateMove(state, "unknown", 3, 2)).toBe("Unknown player");

      const blocked = makeGameState({
        roundPhase: "deployment",
        tiles: makeTiles(8, 8, new Set([coordKey(3, 2)])),
      });
      addTestPlayer(blocked, "p1", { x: 2, y: 2 });
      expect(validateMove(blocked, "p1", 3, 2)).toBe("Blocked");

      const occupied = makeGameState({ roundPhase: "deployment" });
      addTestPlayer(occupied, "p1", { x: 2, y: 2 });
      addTestPlayer(occupied, "p2", { x: 4, y: 2 });
      expect(validateMove(occupied, "p1", 4, 2)).toBe("Tile occupied");
    });

    it("allows non-adjacent moves during deployment", () => {
      const state = makeGameState({ roundPhase: "deployment" });
      addTestPlayer(state, "p1", { x: 2, y: 2 });
      expect(validateMove(state, "p1", 5, 5)).toBeNull();
      applyMove(state, "p1", 5, 5);
      expect(state.players[0]!.x).toBe(5);
      expect(state.players[0]!.y).toBe(5);
    });

    it("requires adjacency outside deployment", () => {
      const state = makeGameState({ roundPhase: "playerTurn", turn: { role: "player", playerId: "p1" } });
      addTestPlayer(state, "p1", { x: 2, y: 2 });
      expect(validateMove(state, "p1", 4, 2)).toBe("Must move to an adjacent tile");
      expect(validateMove(state, "p1", 3, 2)).toBeNull();
    });

    it("rejects moves when not your turn", () => {
      const state = makeGameState({ roundPhase: "playerTurn", turn: { role: "player", playerId: "p2" } });
      addTestPlayer(state, "p1", { x: 2, y: 2 });
      addTestPlayer(state, "p2", { x: 4, y: 2 });
      expect(validateMove(state, "p1", 3, 2)).toBe("Not your turn");
    });
  });

  describe("addPlayer / findSpawn", () => {
    it("spawns on first interior walkable tile", () => {
      const state = makeGameState();
      const ok = addPlayer(state, { id: "p1", x: 0, y: 0 });
      expect(ok).toBe(true);
      expect(state.players[0]!.x).toBe(1);
      expect(state.players[0]!.y).toBe(1);
      expect(findSpawn(state)).toEqual({ x: 2, y: 1 });
    });
  });

  describe("spawnPlayerFromSheet", () => {
    it("spawns a token for a sheet once and refuses a duplicate", () => {
      const state = makeGameState();
      const first = spawnPlayerFromSheet(state, { id: "t1", characterSheetId: "sheet-1" });
      expect(first).toEqual({ playerId: "t1" });
      expect(state.players).toHaveLength(1);
      expect(state.players[0]!.characterSheetId).toBe("sheet-1");

      const second = spawnPlayerFromSheet(state, { id: "t2", characterSheetId: "sheet-1" });
      expect(second).toEqual({ error: "already_on_board" });
      expect(state.players).toHaveLength(1);
    });
  });

  describe("HP", () => {
    it("clampHp and setPlayerHp clamp to max", () => {
      expect(clampHp(15, 10)).toBe(10);
      expect(clampHp(-1, 10)).toBe(0);
      expect(clampHp(7, 10)).toBe(7);

      const state = makeGameState();
      addTestPlayer(state, "p1", { x: 2, y: 2, hp: 10, class: "HARPE" });
      expect(setPlayerHp(state, "p1", 99)).toBeNull();
      expect(state.players[0]!.hp).toBeLessThanOrEqual(99);
      expect(setPlayerHp(state, "missing", 5)).toBe("Unknown player");
    });
  });

  describe("enemies", () => {
    it("validateAddEnemy and addEnemy respect footprints", () => {
      const state = makeGameState();
      addTestPlayer(state, "p1", { x: 3, y: 3 });
      expect(validateAddEnemy(state, 3, 3)).toBe("Tile occupied");
      expect(validateAddEnemy(state, 7, 7, 2)).toBe("Out of bounds");
      expect(validateAddEnemy(state, 4, 4)).toBeNull();

      const err = addEnemy(state, { id: "e1", x: 4, y: 4, name: "Stain Creep" });
      expect(err).toBeNull();
      expect(state.enemies).toHaveLength(1);
      expect(state.enemies[0]!.hp).toBe(1);
    });

    it("allows spawning onto an enemy tile but not a player tile", () => {
      const state = makeGameState();
      addTestPlayer(state, "p1", { x: 3, y: 3 });
      addTestEnemy(state, "e1", 4, 4, { name: "Latent Pudding" });

      expect(validateAddEnemy(state, 3, 3)).toBe("Tile occupied");
      expect(validateAddEnemy(state, 4, 4)).toBeNull();
      expect(addEnemy(state, { id: "e2", x: 4, y: 4, name: "Latent Pudding" })).toBeNull();
      expect(state.enemies).toHaveLength(2);
      expect(state.enemies.every((e) => e.x === 4 && e.y === 4)).toBe(true);
    });

    it("removeEnemy removes by id", () => {
      const state = makeGameState();
      addTestEnemy(state, "e1", 3, 3);
      expect(removeEnemy(state, "e1")).toBe(true);
      expect(state.enemies).toHaveLength(0);
      expect(removeEnemy(state, "missing")).toBe(false);
    });

    it("validateEnemyMove and applyEnemyMove", () => {
      const state = makeGameState({ roundPhase: "gmTurn", turn: { role: "gm" } });
      addTestEnemy(state, "e1", 3, 3, { name: "Stain Creep" });
      state.enemies[0]!.movementRemaining = 2;

      expect(validateEnemyMove(state, "e1", 5, 3)).toBe("Must move to an adjacent tile");
      expect(validateEnemyMove(state, "e1", 4, 3)).toBeNull();
      applyEnemyMove(state, "e1", 4, 3);
      expect(state.enemies[0]!.x).toBe(4);
      expect(state.enemies[0]!.movementRemaining).toBe(1);

      const wrongPhase = makeGameState({ roundPhase: "playerTurn", turn: { role: "player", playerId: "p1" } });
      addTestEnemy(wrongPhase, "e1", 3, 3);
      expect(validateEnemyMove(wrongPhase, "e1", 4, 3)).toBe("Not GM turn");
    });

    it("allows enemy-enemy stacking via movement", () => {
      const stacked = makeGameState({ roundPhase: "gmTurn", turn: { role: "gm" } });
      addTestEnemy(stacked, "a", 3, 3, { name: "Latent Pudding" });
      addTestEnemy(stacked, "b", 4, 3, { name: "Latent Pudding" });
      stacked.enemies[0]!.movementRemaining = 2;
      expect(validateEnemyMove(stacked, "a", 4, 3)).toBeNull();
      applyEnemyMove(stacked, "a", 4, 3);
      expect(stacked.enemies.every((e) => e.x === 4 && e.y === 3)).toBe(true);

      const ontoPlayer = makeGameState({ roundPhase: "gmTurn", turn: { role: "gm" } });
      addTestPlayer(ontoPlayer, "p1", { x: 4, y: 3 });
      addTestEnemy(ontoPlayer, "a", 3, 3, { name: "Latent Pudding" });
      ontoPlayer.enemies[0]!.movementRemaining = 2;
      expect(validateEnemyMove(ontoPlayer, "a", 4, 3)).toBe("Tile occupied");
    });
  });

  describe("canSetPlayerHp", () => {
    it("lets the GM set any player's HP", () => {
      expect(canSetPlayerHp("gm", null, "p1")).toBe(true);
    });

    it("lets a player set only their own HP", () => {
      expect(canSetPlayerHp("player", "p1", "p1")).toBe(true);
      expect(canSetPlayerHp("player", "p1", "p2")).toBe(false);
    });

    it("rejects unauthenticated sockets", () => {
      expect(canSetPlayerHp(null, null, "p1")).toBe(false);
      expect(canSetPlayerHp(undefined, "p1", "p1")).toBe(false);
    });
  });
});
