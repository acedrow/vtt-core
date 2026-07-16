import { describe, expect, it } from "vitest";
import {
  applyGmEnemyAction,
  isAutoResolvableEnemyAttack,
  isSelectTargetEnemyAttack,
} from "@gaem/shared";
import { createDefaultCombatState } from "@gaem/shared";
import { getEnemyAttack } from "@gaem/shared";
import { addTestEnemy, addTestPlayer, makeGameState } from "../fixtures.js";

function gmTurn(state: ReturnType<typeof makeGameState>) {
  state.roundPhase = "gmTurn";
  state.turn = { role: "gm" };
  state.combat = createDefaultCombatState(state.players.length);
}

describe("auto-resolvable enemy attacks", () => {
  it("classifies pattern, select-target, and push attacks from structured specs", () => {
    expect(isAutoResolvableEnemyAttack(getEnemyAttack("Eyesting Rose", 1)!.attack)).toBe(true);
    expect(isAutoResolvableEnemyAttack(getEnemyAttack("Scorned Eyes", 0)!.attack)).toBe(true);
    expect(isAutoResolvableEnemyAttack(getEnemyAttack("Latent Pudding", 0)!.attack)).toBe(true);
    expect(isAutoResolvableEnemyAttack(getEnemyAttack("Eyesting Rose", 0)!.attack)).toBe(false);
    expect(isSelectTargetEnemyAttack(getEnemyAttack("Latent Pudding", 0)!.attack)).toBe(true);
  });

  it("pattern burst auto-hits and does not create pending enemyAttack", () => {
    const state = makeGameState();
    gmTurn(state);
    addTestEnemy(state, "rose", 3, 3, { name: "Eyesting Rose", scale: 1, hp: 100 });
    const player = addTestPlayer(state, "p1", { x: 3, y: 2, hp: 30, class: "HARPE" });
    const msg = applyGmEnemyAction(state, {
      action: "attack",
      enemyId: "rose",
      attackIndex: 1,
      direction: "n",
    });
    expect(msg).toContain("Burst:1");
    expect(msg).toContain("dmg");
    expect(msg).not.toContain("pending");
    expect(player.hp).toBe(20);
    expect(state.combat!.pendingActions.filter((p) => p.kind === "enemyAttack")).toHaveLength(0);
  });

  it("push-only select-target applies push without pending", () => {
    const state = makeGameState();
    gmTurn(state);
    addTestEnemy(state, "pudding", 2, 2, { name: "Latent Pudding", scale: 1, hp: 1 });
    const player = addTestPlayer(state, "p1", { x: 2, y: 1, hp: 20, class: "HARPE" });
    const msg = applyGmEnemyAction(state, {
      action: "attack",
      enemyId: "pudding",
      attackIndex: 0,
      targetPlayerId: "p1",
    });
    expect(msg).not.toContain("pending");
    expect(msg).toMatch(/push|pushed/i);
    expect(player.y).toBe(0);
    expect(state.combat!.pendingActions.filter((p) => p.kind === "enemyAttack")).toHaveLength(0);
  });

  it("unresolvable attacks log guidance instead of pending", () => {
    const state = makeGameState();
    gmTurn(state);
    addTestEnemy(state, "rose", 3, 3, { name: "Eyesting Rose", scale: 1, hp: 100 });
    const msg = applyGmEnemyAction(state, {
      action: "attack",
      enemyId: "rose",
      attackIndex: 0,
    });
    expect(msg).toContain("not auto-resolved");
    expect(state.combat!.pendingActions.filter((p) => p.kind === "enemyAttack")).toHaveLength(0);
  });

  it("direct select-target damages adjacent creature enemy", () => {
    const state = makeGameState();
    gmTurn(state);
    addTestEnemy(state, "creep", 2, 2, { name: "Stain Creep", scale: 1, hp: 1 });
    const other = addTestEnemy(state, "other", 2, 1, { name: "Latent Pudding", scale: 1, hp: 1 });
    const msg = applyGmEnemyAction(state, {
      action: "attack",
      enemyId: "creep",
      attackIndex: 0,
      targetEnemyId: "other",
    });
    expect(msg).toContain("dmg");
    expect(other.hp).toBe(0);
  });

  it("scale-2 cone uses a single edge origin, not the full facing edge", () => {
    const state = makeGameState({ width: 10, height: 10 });
    gmTurn(state);
    addTestEnemy(state, "g", 4, 4, { name: "Gorgenaut", scale: 2, hp: 100 });
    const left = addTestPlayer(state, "p1", { x: 4, y: 3, hp: 20, class: "HARPE" });
    const right = addTestPlayer(state, "p2", { x: 5, y: 3, hp: 20, class: "HARPE" });
    applyGmEnemyAction(state, {
      action: "attack",
      enemyId: "g",
      attackIndex: 0,
      direction: "n",
      originX: 4,
      originY: 4,
    });
    expect(left.hp).toBe(15);
    expect(right.hp).toBe(20);
  });
});
