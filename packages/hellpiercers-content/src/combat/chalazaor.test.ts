import { describe, expect, it } from "vitest";
import { applyDamageToEnemy, isAutoResolvableEnemyAttack } from "@gaem/shared";
import {
  applyFlowerbudPlant,
  isSoaringBombardier,
  tryChalazaorDamageNegation,
  validateFlowerbudPlant,
} from "./chalazaor.js";
import { getCountdownKind } from "@gaem/shared";
import { applyGmEnemyAction, validateGmEnemyAction } from "@gaem/shared";
import { createDefaultCombatState } from "@gaem/shared";
import { getEnemyAttack } from "@gaem/shared";
import { addTestEnemy, addTestPlayer, makeGameState } from "../../../shared/src/test/fixtures.js";

function gmTurn(state: ReturnType<typeof makeGameState>) {
  state.roundPhase = "gmTurn";
  state.turn = { role: "gm" };
  state.combat = createDefaultCombatState(state.players.length);
}

describe("chalazaor / Soaring Bombardier", () => {
  it("detects bombardier and flowerbud-plant encoding", () => {
    expect(isSoaringBombardier({ name: "Soaring Bombardier" })).toBe(true);
    expect(isSoaringBombardier({ name: "CHALAZAOR" })).toBe(true);
    expect(isAutoResolvableEnemyAttack(getEnemyAttack("Soaring Bombardier", 0)!.attack)).toBe(true);
    expect(isAutoResolvableEnemyAttack(getEnemyAttack("Soaring Bombardier", 1)!.attack)).toBe(true);
  });

  it("plants Flowerbud on adjacent empty tile via applyGmEnemyAction", () => {
    const state = makeGameState();
    gmTurn(state);
    addTestEnemy(state, "ch", 3, 3, { name: "Soaring Bombardier", hp: 80 });
    expect(
      validateGmEnemyAction(state, {
        action: "attack",
        enemyId: "ch",
        attackIndex: 0,
        destX: 4,
        destY: 3,
      }),
    ).toBeNull();
    const msg = applyGmEnemyAction(state, {
      action: "attack",
      enemyId: "ch",
      attackIndex: 0,
      destX: 4,
      destY: 3,
    });
    expect(msg).toContain("Flowerbud");
    const bud = state.enemies.find((e) => e.name === "Flowerbud");
    expect(bud).toMatchObject({ x: 4, y: 3, hp: 1 });
    expect(bud?.effects?.Countdown).toBe(2);
    expect(getCountdownKind(state, bud!.id)).toBe("flowerbud");
  });

  it("rejects occupied or non-adjacent plant destinations", () => {
    const state = makeGameState();
    gmTurn(state);
    const enemy = addTestEnemy(state, "ch", 3, 3, { name: "Soaring Bombardier", hp: 80 });
    addTestPlayer(state, "p1", { x: 4, y: 3, hp: 10, class: "HARPE" });
    expect(validateFlowerbudPlant(state, enemy, { destX: 4, destY: 3 })).not.toBeNull();
    expect(validateFlowerbudPlant(state, enemy, { destX: 5, destY: 5 })).toBe(
      "Destination must be adjacent",
    );
  });

  it("agnosia applies Countdown:10 without pending GM", () => {
    const state = makeGameState();
    gmTurn(state);
    const enemy = addTestEnemy(state, "ch", 3, 3, {
      name: "Soaring Bombardier",
      hp: 11,
    });
    applyDamageToEnemy(enemy, 2, state);
    expect(enemy.agnosiaTriggered).toBe(true);
    expect(enemy.effects?.Countdown).toBe(10);
    expect(getCountdownKind(state, enemy.id)).toBe("chazaor_agnosia");
    expect(state.combat!.pendingActions.some((p) => p.label.includes("Agnosia"))).toBe(false);
  });

  it("negates damage and ticks Countdown while shielded", () => {
    const state = makeGameState();
    gmTurn(state);
    const enemy = addTestEnemy(state, "ch", 3, 3, {
      name: "Soaring Bombardier",
      hp: 10,
      effects: { Countdown: 5 },
    });
    enemy.agnosiaTriggered = true;
    const dealt = applyDamageToEnemy(enemy, 8, state);
    expect(dealt).toBe(0);
    expect(enemy.hp).toBe(10);
    expect(enemy.effects?.Countdown).toBe(4);
  });

  it("damage that zeroes Countdown kills with Burst:2", () => {
    const state = makeGameState();
    gmTurn(state);
    addTestPlayer(state, "p1", { x: 3, y: 3, hp: 20, class: "HARPE" });
    const enemy = addTestEnemy(state, "ch", 3, 3, {
      name: "Soaring Bombardier",
      hp: 10,
      effects: { Countdown: 1 },
    });
    enemy.agnosiaTriggered = true;
    applyDamageToEnemy(enemy, 1, state);
    expect(enemy.hp).toBe(0);
    expect(state.players[0]!.hp).toBe(15);
  });

  it("applyFlowerbudPlant fails validation when called with bad coords", () => {
    const state = makeGameState();
    gmTurn(state);
    const enemy = addTestEnemy(state, "ch", 2, 2, { name: "Soaring Bombardier", hp: 80 });
    expect(validateFlowerbudPlant(state, enemy, {})).toBe("Select adjacent square");
    const msg = applyFlowerbudPlant(state, enemy, 3, 2);
    expect(msg).toContain("planted Flowerbud");
  });

  it("tryChalazaorDamageNegation ignores non-agnosia bombardier", () => {
    const state = makeGameState();
    gmTurn(state);
    const enemy = addTestEnemy(state, "ch", 2, 2, {
      name: "Soaring Bombardier",
      hp: 80,
      effects: { Countdown: 3 },
    });
    expect(tryChalazaorDamageNegation(state, enemy)).toBeNull();
  });
});
