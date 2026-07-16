import { getEffectiveEnemyMaxHp, getSwarmMaxHp } from "../../combat/swarm.js";
import { describe, expect, it } from "vitest";
import { applyPhaseAction, getEnemyMaxHp, getPlayerMaxHp } from "@gaem/shared";
import { resetUnitCombatState } from "@gaem/shared";
import { createDefaultCombatState } from "@gaem/shared";
import type { GameMap } from "@gaem/shared";
import { addTestEnemy, addTestPlayer, gmCtx, makeGameState } from "../fixtures.js";

describe("resetUnitCombatState", () => {
  it("restores HP, clears effects, and resets equipment uses", () => {
    const state = makeGameState();
    const player = addTestPlayer(state, "p1", {
      x: 2,
      y: 2,
      hp: 3,
      class: "HARPE",
      equipmentUses: 0,
      effects: { Bleed: 2, Armor: 1 },
    });
    player.reversalCharges = 0;
    resetUnitCombatState(player);
    expect(player.hp).toBe(getPlayerMaxHp(player));
    expect(player.effects).toBeUndefined();
    expect(player.equipmentUses).toBe(1);
  });
});

describe("TACCOM phase actions", () => {
  it("endDeployment enters TACCOM and resets players", () => {
    const state = makeGameState({
      roundPhase: "deployment",
      combat: createDefaultCombatState(1),
    });
    const player = addTestPlayer(state, "p1", {
      x: 2,
      y: 2,
      hp: 4,
      class: "HARPE",
      effects: { Slow: 1 },
    });
    applyPhaseAction(state, "endDeployment", gmCtx());
    expect(state.roundPhase).toBe("startRoundEffects");
    expect(state.combat).toBeDefined();
    expect(player.hp).toBe(getPlayerMaxHp(player));
    expect(player.effects).toBeUndefined();
  });

  it("endCombat exits to TACCOM not started and resets players", () => {
    const state = makeGameState({
      round: 2,
      roundPhase: "gmTurn",
      combat: createDefaultCombatState(1),
    });
    const player = addTestPlayer(state, "p1", {
      x: 2,
      y: 2,
      hp: 2,
      class: "HARPE",
      effects: { Pin: 1 },
    });
    applyPhaseAction(state, "endCombat", gmCtx());
    expect(state.roundPhase).toBe("taccomNotStarted");
    expect(state.round).toBe(1);
    expect(player.hp).toBe(getPlayerMaxHp(player));
    expect(player.effects).toBeUndefined();
  });

  it("resetCombat exits to TACCOM not started", () => {
    const state = makeGameState({
      round: 2,
      roundPhase: "gmTurn",
      combat: createDefaultCombatState(1),
    });
    addTestPlayer(state, "p1", { x: 2, y: 2, class: "HARPE" });
    applyPhaseAction(state, "resetCombat", gmCtx());
    expect(state.roundPhase).toBe("taccomNotStarted");
    expect(state.round).toBe(1);
    expect(state.combat).toBeDefined();
  });

  it("resetCombat restores board from map startingState when present", () => {
    const state = makeGameState({
      round: 2,
      roundPhase: "gmTurn",
      combat: createDefaultCombatState(1),
      enemies: [{ id: "e1", x: 3, y: 3, name: "Stain Creep", hp: 99, scale: 1 }],
    });
    addTestPlayer(state, "p1", { x: 2, y: 2, class: "HARPE" });
    const map: GameMap = {
      id: "test",
      width: state.width,
      height: state.height,
      tiles: state.tiles.map((t) => ({ ...t, terrain: [...t.terrain] })),
      startingState: {
        tiles: state.tiles.map((t) => ({ ...t, terrain: [...t.terrain] })),
        enemies: [{ id: "e1", x: 1, y: 1, name: "Stain Creep", hp: 1, scale: 1 }],
      },
    };
    const message = applyPhaseAction(state, "resetCombat", gmCtx(), map);
    expect(message).toContain("starting state");
    expect(state.roundPhase).toBe("taccomNotStarted");
    expect(state.enemies).toHaveLength(1);
    expect(state.enemies[0]!.x).toBe(1);
    expect(state.enemies[0]!.hp).toBe(getEnemyMaxHp(state.enemies[0]!));
  });

  it("resetCombat restores enemy HP, clears agnosia, and counters", () => {
    const state = makeGameState({
      round: 2,
      roundPhase: "gmTurn",
      combat: {
        ...createDefaultCombatState(1),
        passedEnemyIdsByPlayer: { p1: ["e1"] },
      },
      enemies: [
        {
          id: "e1",
          x: 3,
          y: 3,
          name: "Gorgenaut",
          hp: 12,
          scale: 2,
          agnosiaTriggered: true,
          burrowed: true,
          effects: { Slow: 1 },
        },
      ],
    });
    const player = addTestPlayer(state, "p1", {
      x: 2,
      y: 2,
      class: "HARPE",
      hp: 3,
      counters: { foo: 2 },
    });
    applyPhaseAction(state, "resetCombat", gmCtx());
    expect(state.enemies[0]!.hp).toBe(getEnemyMaxHp(state.enemies[0]!));
    expect(state.enemies[0]!.agnosiaTriggered).toBeUndefined();
    expect(state.enemies[0]!.burrowed).toBeUndefined();
    expect(state.enemies[0]!.effects).toBeUndefined();
    expect(state.combat!.passedEnemyIdsByPlayer).toBeUndefined();
    expect(player.hp).toBe(getPlayerMaxHp(player));
    expect(player.counters?.foo).toBeUndefined();
  });

  it("resetCombat restores swarm pool HP to size*10, not listing HP 1", () => {
    const state = makeGameState({
      round: 2,
      roundPhase: "gmTurn",
      combat: createDefaultCombatState(1),
    });
    addTestPlayer(state, "p1", { x: 0, y: 0, class: "HARPE" });
    addTestEnemy(state, "a", 2, 2, { name: "Scorned Eyes", hp: 5 });
    addTestEnemy(state, "b", 3, 2, { name: "Scorned Eyes", hp: 5 });
    addTestEnemy(state, "c", 4, 2, { name: "Scorned Eyes", hp: 5 });
    applyPhaseAction(state, "resetCombat", gmCtx());
    expect(getSwarmMaxHp(3)).toBe(30);
    for (const enemy of state.enemies) {
      expect(getEnemyMaxHp(enemy)).toBe(1);
      expect(enemy.hp).toBe(30);
      expect(getEffectiveEnemyMaxHp(enemy, state)).toBe(30);
    }
  });
});
