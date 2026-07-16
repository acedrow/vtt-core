import { describe, expect, it } from "vitest";
import {
  applyAttractorEndOfTurnPulls,
  applyAttractorEntryPulls,
  checkSharurEmergencyDefenses,
  clearAttractorPullForEnemy,
  convertOwnerAttractorsToVoid,
  placeAttractor,
} from "@gaem/shared";
import { applyMovePath } from "@gaem/shared";
import { applyDamageToPlayer } from "@gaem/shared";
import { createDefaultCombatState } from "@gaem/shared";
import { addTestEnemy, addTestPlayer, makeGameState } from "../fixtures.js";
import { applyVoidTileDefeat, enemyFullyOnVoid } from "@gaem/shared";
import { applyEnemyMove, setPlayerHp } from "@gaem/shared";

function combatPlayerTurn(state: ReturnType<typeof makeGameState>, playerId: string) {
  state.roundPhase = "playerTurn";
  state.turn = { role: "player", playerId };
  state.combat = createDefaultCombatState(state.players.length);
}

function combatGmTurn(state: ReturnType<typeof makeGameState>) {
  state.roundPhase = "gmTurn";
  state.turn = { role: "gm" };
  state.combat = state.combat ?? createDefaultCombatState(state.players.length);
}

describe("attractor", () => {
  it("pulls a unit toward the attractor when entering the zone", () => {
    const state = makeGameState();
    addTestPlayer(state, "sharur", { x: 0, y: 0, class: "SHARUR" });
    const enemy = addTestEnemy(state, "e1", 4, 2);
    combatGmTurn(state);
    placeAttractor(state, "sharur", 2, 2);

    clearAttractorPullForEnemy(state, "e1");
    applyEnemyMove(state, "e1", 3, 2);

    expect(enemy.x).toBe(2);
    expect(enemy.y).toBe(2);
  });

  it("applies an additional pull when ending turn in the zone", () => {
    const state = makeGameState();
    addTestPlayer(state, "sharur", { x: 0, y: 0, class: "SHARUR" });
    const enemy = addTestEnemy(state, "e1", 3, 2);
    combatGmTurn(state);
    placeAttractor(state, "sharur", 2, 2);

    const msgs = applyAttractorEndOfTurnPulls(state, enemy, "enemy");
    expect(msgs.length).toBeGreaterThan(0);
    expect(enemy.x).toBe(2);
    expect(enemy.y).toBe(2);
  });

  it("limits enemies to one attractor pull per turn", () => {
    const state = makeGameState();
    addTestPlayer(state, "sharur", { x: 0, y: 0, class: "SHARUR" });
    const enemy = addTestEnemy(state, "e1", 4, 2);
    combatGmTurn(state);
    placeAttractor(state, "sharur", 2, 2);

    clearAttractorPullForEnemy(state, "e1");
    applyEnemyMove(state, "e1", 3, 2);
    expect(enemy.x).toBe(2);
    expect(enemy.y).toBe(2);

    const endMsgs = applyAttractorEndOfTurnPulls(state, enemy, "enemy");
    expect(endMsgs).toEqual([]);
    expect(enemy.x).toBe(2);
    expect(enemy.y).toBe(2);
  });

  it("replaces the previous attractor when placing a new one", () => {
    const state = makeGameState();
    addTestPlayer(state, "sharur", { x: 0, y: 0, class: "SHARUR", hp: 20 });
    state.combat = createDefaultCombatState(1);
    placeAttractor(state, "sharur", 2, 2);
    placeAttractor(state, "sharur", 5, 5);

    expect(state.combat!.attractors).toHaveLength(1);
    expect(state.combat!.attractors![0]).toMatchObject({ x: 5, y: 5, void: false });
  });

  it("converts attractors via setPlayerHp", () => {
    const state = makeGameState();
    addTestPlayer(state, "sharur", { x: 0, y: 0, class: "SHARUR", hp: 20 });
    state.combat = createDefaultCombatState(1);
    placeAttractor(state, "sharur", 2, 2);

    expect(setPlayerHp(state, "sharur", 10)).toBeNull();
    expect(state.combat!.attractors![0]!.void).toBe(true);
    expect(state.tiles.find((t) => t.x === 2 && t.y === 2)?.terrain).toContain("void");
    expect(state.tiles.find((t) => t.x === 2 && t.y === 2)?.walkable).toBe(false);
  });

  it("spawns void attractors when Sharur is at 10 HP or fewer", () => {
    const state = makeGameState();
    const sharur = addTestPlayer(state, "sharur", { x: 0, y: 0, class: "SHARUR", hp: 10 });
    state.combat = createDefaultCombatState(1);
    checkSharurEmergencyDefenses(state, sharur);

    placeAttractor(state, "sharur", 3, 3);

    expect(state.combat!.attractors![0]!.void).toBe(true);
    expect(state.tiles.find((t) => t.x === 3 && t.y === 3)?.terrain).toContain("void");
  });

  it("converts owner attractors to void at 10 HP or fewer", () => {
    const state = makeGameState();
    const sharur = addTestPlayer(state, "sharur", { x: 0, y: 0, class: "SHARUR", hp: 15 });
    combatPlayerTurn(state, "sharur");
    placeAttractor(state, "sharur", 2, 2);

    applyDamageToPlayer(sharur, 6, state);
    expect(sharur.hp).toBe(9);
    expect(state.combat!.attractors![0]!.void).toBe(true);
    expect(state.tiles.find((t) => t.x === 2 && t.y === 2)?.terrain).toContain("void");
    expect(state.tiles.find((t) => t.x === 2 && t.y === 2)?.walkable).toBe(false);
  });

  it("kills a unit pulled into a void attractor", () => {
    const state = makeGameState();
    addTestPlayer(state, "sharur", { x: 0, y: 0, class: "SHARUR" });
    const enemy = addTestEnemy(state, "e1", 2, 3);
    combatGmTurn(state);
    placeAttractor(state, "sharur", 2, 2);
    convertOwnerAttractorsToVoid(state, "sharur");

    clearAttractorPullForEnemy(state, "e1");
    applyAttractorEntryPulls(state, enemy, "enemy");

    expect(enemy.hp).toBe(0);
  });

  it("does not kill scale-2 enemies unless fully on void tiles", () => {
    const state = makeGameState({ width: 8, height: 8 });
    const tile = state.tiles.find((t) => t.x === 3 && t.y === 3);
    if (tile) tile.terrain = ["void"];
    const enemy = addTestEnemy(state, "e1", 2, 3, { scale: 2, hp: 10 });

    expect(enemyFullyOnVoid(state, enemy)).toBe(false);
    expect(applyVoidTileDefeat(state, enemy, "enemy")).toBeNull();
    expect(enemy.hp).toBe(10);
  });

  it("kills scale-2 enemies when all footprint tiles are void", () => {
    const state = makeGameState({ width: 8, height: 8 });
    for (const key of ["3,3", "4,3", "3,4", "4,4"]) {
      const [x, y] = key.split(",").map(Number);
      const tile = state.tiles.find((t) => t.x === x && t.y === y);
      if (tile) tile.terrain = ["void"];
    }
    const enemy = addTestEnemy(state, "e1", 3, 3, { scale: 2, hp: 10 });

    expect(enemyFullyOnVoid(state, enemy)).toBe(true);
    expect(applyVoidTileDefeat(state, enemy, "enemy")).toContain("Void");
    expect(enemy.hp).toBe(0);
  });

  it("pulls players entering the attractor zone during movement", () => {
    const state = makeGameState();
    addTestPlayer(state, "sharur", { x: 0, y: 0, class: "SHARUR" });
    const player = addTestPlayer(state, "p2", { x: 4, y: 2, actionBudget: true });
    combatPlayerTurn(state, "p2");
    placeAttractor(state, "sharur", 2, 2);

    applyMovePath(state, "p2", [{ x: 3, y: 2 }]);

    expect(player.x).toBeLessThan(3);
  });
});

describe("checkSharurEmergencyDefenses", () => {
  it("only triggers once per Sharur", () => {
    const state = makeGameState();
    const sharur = addTestPlayer(state, "sharur", { x: 0, y: 0, class: "SHARUR", hp: 10 });
    combatPlayerTurn(state, "sharur");
    placeAttractor(state, "sharur", 2, 2);

    expect(checkSharurEmergencyDefenses(state, sharur)).toContain("Emergency Auto Defenses");
    expect(checkSharurEmergencyDefenses(state, sharur)).toBeNull();
  });
});
