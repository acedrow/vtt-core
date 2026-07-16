import { describe, expect, it } from "vitest";
import {
  applyGorgenautConeAttack,
  applyGorgenautStainTeleport,
  isGorgenaut,
  validateGorgenautStainTeleport,
} from "./gorgenaut.js";
import { applyGmEnemyAction, validateGmEnemyAction } from "@gaem/shared";
import { hasSpecialIdHandler } from "@gaem/shared";
import { createDefaultCombatState } from "@gaem/shared";
import { getEnemyAttack } from "@gaem/shared";
import { tileAt } from "@gaem/shared";
import { addTestEnemy, addTestPlayer, makeGameState } from "../../../shared/src/test/fixtures.js";

function stainTile(state: ReturnType<typeof makeGameState>, x: number, y: number): void {
  const tile = tileAt(state.tiles, x, y)!;
  tile.tileEffects = { ...(tile.tileEffects ?? {}), Stained: 1 };
}

function gmTurn(state: ReturnType<typeof makeGameState>) {
  state.roundPhase = "gmTurn";
  state.turn = { role: "gm" };
  state.combat = createDefaultCombatState(state.players.length);
}

describe("gorgenaut attacks", () => {
  it("detects gorgenaut and stain-teleport attacks", () => {
    expect(isGorgenaut({ name: "RETIARIUS" })).toBe(true);
    expect(getEnemyAttack("Gorgenaut", 1)!.attack.specialId).toBe("stain-teleport");
    expect(hasSpecialIdHandler("stain-teleport")).toBe(true);
  });

  it("cone deals damage and pulls units toward RETIARIUS", () => {
    const state = makeGameState();
    gmTurn(state);
    const enemy = addTestEnemy(state, "g", 2, 2, { name: "Gorgenaut", scale: 2, hp: 100 });
    const player = addTestPlayer(state, "p1", { x: 2, y: 0, hp: 20, class: "HARPE" });
    const msg = applyGorgenautConeAttack(state, enemy, "n", 5);
    expect(msg).toContain("5");
    expect(player.hp).toBe(15);
    expect(player.y).toBe(1);
  });

  it("stain teleport damages and moves target", () => {
    const state = makeGameState();
    gmTurn(state);
    const enemy = addTestEnemy(state, "g", 2, 2, { name: "Gorgenaut", scale: 2, hp: 100 });
    const player = addTestPlayer(state, "p1", { x: 2, y: 1, hp: 20, class: "HARPE" });
    stainTile(state, 5, 5);
    expect(
      validateGorgenautStainTeleport(state, enemy, {
        targetPlayerId: "p1",
        destX: 5,
        destY: 5,
      }),
    ).toBeNull();
    applyGorgenautStainTeleport(state, enemy, {
      targetPlayerId: "p1",
      destX: 5,
      destY: 5,
      damage: 10,
    });
    expect(player.hp).toBe(10);
    expect(player.x).toBe(5);
    expect(player.y).toBe(5);
  });

  it("rejects non-stained destination", () => {
    const state = makeGameState();
    gmTurn(state);
    const enemy = addTestEnemy(state, "g", 2, 2, { name: "Gorgenaut", scale: 2, hp: 100 });
    addTestPlayer(state, "p1", { x: 2, y: 1, hp: 20 });
    expect(
      validateGorgenautStainTeleport(state, enemy, {
        targetPlayerId: "p1",
        destX: 5,
        destY: 5,
      }),
    ).toBe("Destination must be stained");
  });

  it("applyGmEnemyAction automates both attacks", () => {
    const state = makeGameState();
    gmTurn(state);
    addTestEnemy(state, "g", 2, 2, { name: "Gorgenaut", scale: 2, hp: 100 });
    addTestPlayer(state, "p1", { x: 2, y: 0, hp: 20, class: "HARPE" });
    expect(
      validateGmEnemyAction(state, {
        action: "attack",
        enemyId: "g",
        attackIndex: 0,
        direction: "n",
        originX: 2,
        originY: 2,
      }),
    ).toBeNull();
    const coneMsg = applyGmEnemyAction(state, {
      action: "attack",
      enemyId: "g",
      attackIndex: 0,
      direction: "n",
      originX: 2,
      originY: 2,
    });
    expect(coneMsg).toContain("Cone");
    expect(coneMsg).not.toContain("pending");

    stainTile(state, 6, 6);
    addTestPlayer(state, "p2", { x: 1, y: 2, hp: 20, class: "HARPE" });
    expect(
      validateGmEnemyAction(state, {
        action: "attack",
        enemyId: "g",
        attackIndex: 1,
        targetPlayerId: "p2",
        destX: 6,
        destY: 6,
      }),
    ).toBeNull();
    const tpMsg = applyGmEnemyAction(state, {
      action: "attack",
      enemyId: "g",
      attackIndex: 1,
      targetPlayerId: "p2",
      destX: 6,
      destY: 6,
    });
    expect(tpMsg).toContain("moved to (6, 6)");
    expect(state.players.find((p) => p.id === "p2")).toMatchObject({ x: 6, y: 6, hp: 10 });
  });
});
