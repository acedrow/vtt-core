import { describe, expect, it } from "vitest";
import { applyDamageToEnemy, enemyDirectAttackTargetPlayerIds, isAutoResolvableEnemyAttack } from "@gaem/shared";
import {
  enemyBlocksTileOccupancy,
  isLurkingFreak,
} from "./lurking-freak.js";
import { applyGmEnemyAction, validateGmEnemyAction } from "@gaem/shared";
import { validateMovementPath } from "@gaem/shared";
import { tileIsStained } from "./stainwalk.js";
import { createDefaultCombatState } from "@gaem/shared";
import { getEnemyAttack } from "@gaem/shared";
import { isTileOccupied } from "@gaem/shared";
import { tileAt } from "@gaem/shared";
import { addTestEnemy, addTestPlayer, makeGameState } from "../../../shared/src/test/fixtures.js";

function gmTurn(state: ReturnType<typeof makeGameState>) {
  state.roundPhase = "gmTurn";
  state.turn = { role: "gm" };
  state.combat = createDefaultCombatState(state.players.length);
}

describe("lurking freak / POTAGON", () => {
  it("detects lurking freak and auto-resolvable attacks", () => {
    expect(isLurkingFreak({ name: "Lurking Freak" })).toBe(true);
    expect(isLurkingFreak({ name: "POTAGON" })).toBe(true);
    expect(isAutoResolvableEnemyAttack(getEnemyAttack("Lurking Freak", 0)!.attack)).toBe(true);
    expect(isAutoResolvableEnemyAttack(getEnemyAttack("Lurking Freak", 1)!.attack)).toBe(true);
  });

  it("line attack damages and stains pattern tiles including empty ones", () => {
    const state = makeGameState({ width: 12, height: 12 });
    gmTurn(state);
    addTestEnemy(state, "f", 3, 5, { name: "Lurking Freak", scale: 2, hp: 90 });
    const player = addTestPlayer(state, "p1", { x: 3, y: 2, hp: 20, class: "HARPE" });
    expect(
      validateGmEnemyAction(state, {
        action: "attack",
        enemyId: "f",
        attackIndex: 0,
        direction: "n",
        originX: 3,
        originY: 5,
      }),
    ).toBeNull();
    const msg = applyGmEnemyAction(state, {
      action: "attack",
      enemyId: "f",
      attackIndex: 0,
      direction: "n",
      originX: 3,
      originY: 5,
      damage: 4,
    });
    expect(msg).toContain("Line:4");
    expect(msg).toContain("stained");
    expect(player.hp).toBe(16);
    expect(tileAt(state.tiles, 3, 2)?.tileEffects?.Stained).toBe(1);
    expect(tileAt(state.tiles, 3, 2)?.overlayKey).toMatch(/^tiles\/overlays\/stain\/stain\/\d+\.png$/);
    expect(tileAt(state.tiles, 3, 1)?.tileEffects?.Stained).toBe(1);
    expect(tileAt(state.tiles, 3, 0)?.tileEffects?.Stained).toBe(1);
  });

  it("melee applies damage and Pin via applyGmEnemyAction", () => {
    const state = makeGameState();
    gmTurn(state);
    addTestEnemy(state, "f", 3, 3, { name: "Lurking Freak", scale: 2, hp: 90 });
    const player = addTestPlayer(state, "p1", { x: 3, y: 2, hp: 20, class: "HARPE" });
    const msg = applyGmEnemyAction(state, {
      action: "attack",
      enemyId: "f",
      attackIndex: 1,
      targetPlayerId: "p1",
      damage: 10,
    });
    expect(msg).toContain("10");
    expect(player.hp).toBe(10);
    expect(player.effects?.Pin).toBe(1);
  });

  it("agnosia burrows without pending GM", () => {
    const state = makeGameState();
    gmTurn(state);
    const enemy = addTestEnemy(state, "f", 3, 3, { name: "Lurking Freak", scale: 2, hp: 15 });
    applyDamageToEnemy(enemy, 6, state);
    expect(enemy.hp).toBe(9);
    expect(enemy.agnosiaTriggered).toBe(true);
    expect(enemy.burrowed).toBe(true);
    expect(enemyBlocksTileOccupancy(enemy)).toBe(false);
    expect(state.combat!.pendingActions.some((p) => p.label.includes("Agnosia"))).toBe(false);
  });

  it("burrowed footprint counts as Stained and allows co-occupy", () => {
    const state = makeGameState();
    gmTurn(state);
    const enemy = addTestEnemy(state, "f", 3, 3, { name: "Lurking Freak", scale: 2, hp: 9 });
    enemy.burrowed = true;
    enemy.agnosiaTriggered = true;
    expect(tileIsStained(state, 3, 3)).toBe(true);
    expect(tileIsStained(state, 4, 4)).toBe(true);
    expect(tileIsStained(state, 5, 5)).toBe(false);
    expect(isTileOccupied(state, 3, 3)).toBe(false);

    const player = addTestPlayer(state, "p1", {
      x: 2,
      y: 3,
      hp: 20,
      class: "HARPE",
      actionBudget: true,
    });
    expect(validateMovementPath(state, "p1", [{ x: 3, y: 3 }])).toBeNull();
    player.x = 3;
    player.y = 3;
    expect(player.x).toBe(enemy.x);
    expect(player.y).toBe(enemy.y);
  });

  it("burrowed POTAGON remains adjacent-targetable", () => {
    const state = makeGameState();
    gmTurn(state);
    const enemy = addTestEnemy(state, "f", 3, 3, { name: "Lurking Freak", scale: 2, hp: 9 });
    enemy.burrowed = true;
    enemy.agnosiaTriggered = true;
    const player = addTestPlayer(state, "p1", { x: 5, y: 3, hp: 20, class: "HARPE" });
    expect(
      enemyDirectAttackTargetPlayerIds(state, "f", getEnemyAttack("Lurking Freak", 1)!.attack),
    ).toContain("p1");
    const msg = applyGmEnemyAction(state, {
      action: "attack",
      enemyId: "f",
      attackIndex: 1,
      targetPlayerId: "p1",
      damage: 10,
    });
    expect(msg).toContain("10");
    expect(player.hp).toBe(10);
  });
});
