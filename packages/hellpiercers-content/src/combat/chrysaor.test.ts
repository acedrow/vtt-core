import { describe, expect, it } from "vitest";

import {
  applyClassActive,
  applyResolveClassReaction,
  validateClassActive,
} from "./class-abilities.js";
import {
  applySoulBranding,
  BRAND_EFFECT,
  maybeOfferBrandStrip,
  obstacleBrandKey,
  stripOwnedBrand,
  tickBrands,
} from "./chrysaor.js";
import { applyPatternEnemyAttack, applySelectTargetEnemyAttack } from "@gaem/shared";
import type { EnemyAttackSpec } from "@gaem/shared";
import { applyTileEffectStacks } from "@gaem/shared";
import { createDefaultCombatState } from "@gaem/shared";
import { applyGmPaintTile } from "@gaem/shared";
import { tileAt } from "@gaem/shared";
import { addTestEnemy, addTestPlayer, makeGameState } from "../../../shared/src/test/fixtures.js";

describe("CHRYSAOR Brand", () => {
  it("marks enemy in LoS with Brand:2 and ownership", () => {
    const state = makeGameState();
    addTestPlayer(state, "p1", { x: 2, y: 2, class: "CHRYSAOR", actionBudget: true });
    addTestEnemy(state, "e1", 3, 2, { name: "Gorgenaut" });
    state.roundPhase = "playerTurn";
    state.turn = { role: "player", playerId: "p1" };
    state.combat = createDefaultCombatState(1);

    const msg = applyClassActive(state, "p1", {
      action: "classActive",
      kind: "soul_branding",
      targetEnemyIds: ["e1"],
    });
    expect(msg).toContain("Soul-Branding");
    expect(state.enemies.find((e) => e.id === "e1")?.effects?.[BRAND_EFFECT]).toBe(2);
    expect(state.combat!.chrysaorBrands!["e1"]).toBe("p1");
  });

  it("rejects enemy blocked by obstacle", () => {
    const state = makeGameState();
    const player = addTestPlayer(state, "p1", { x: 2, y: 2, class: "CHRYSAOR", actionBudget: true });
    addTestEnemy(state, "e1", 5, 2, { name: "Gorgenaut" });
    tileAt(state.tiles, 3, 2)!.terrain = ["obstacle"];
    state.roundPhase = "playerTurn";
    state.turn = { role: "player", playerId: "p1" };
    state.combat = createDefaultCombatState(1);

    expect(
      validateClassActive(state, player, {
        action: "classActive",
        kind: "soul_branding",
        targetEnemyIds: ["e1"],
      }),
    ).toBe("No line of sight");
  });

  it("marks obstacle via tileEffects", () => {
    const state = makeGameState();
    addTestPlayer(state, "p1", { x: 2, y: 2, class: "CHRYSAOR", actionBudget: true });
    applyGmPaintTile(state, 4, 2, { terrain: "obstacle", obstacleHp: 15 });
    state.roundPhase = "playerTurn";
    state.turn = { role: "player", playerId: "p1" };
    state.combat = createDefaultCombatState(1);

    const msg = applyClassActive(state, "p1", {
      action: "classActive",
      kind: "soul_branding",
      x: 4,
      y: 2,
    });
    expect(msg).toContain("obstacle");
    expect(tileAt(state.tiles, 4, 2)!.tileEffects?.[BRAND_EFFECT]).toBe(2);
    expect(state.combat!.chrysaorBrands![obstacleBrandKey(4, 2)]).toBe("p1");
  });

  it("ticks Brand end of round then detonates", () => {
    const state = makeGameState({ width: 6, height: 6 });
    addTestPlayer(state, "p1", { x: 0, y: 0, class: "CHRYSAOR", hp: 20 });
    const enemy = addTestEnemy(state, "e1", 3, 3, { name: "Gorgenaut", hp: 100, scale: 1 });
    const adj = addTestEnemy(state, "e2", 3, 2, { name: "Gorgenaut", hp: 100, scale: 1 });
    state.combat = createDefaultCombatState(1);
    applySoulBranding(state, "p1", { kind: "enemy", id: "e1" });
    expect(enemy.effects?.[BRAND_EFFECT]).toBe(2);

    const tick1 = tickBrands(state, () => 0.99);
    expect(tick1.some((m) => m.includes("Brand 2 → 1"))).toBe(true);
    expect(enemy.effects?.[BRAND_EFFECT]).toBe(1);
    expect(state.combat!.chrysaorBrands!["e1"]).toBe("p1");

    const tick2 = tickBrands(state, () => 0.99);
    expect(tick2.some((m) => m.includes("Brand detonated"))).toBe(true);
    expect(enemy.effects?.[BRAND_EFFECT]).toBeUndefined();
    expect(state.combat!.chrysaorBrands!["e1"]).toBeUndefined();
    expect(enemy.hp).toBe(76);
    expect(adj.hp).toBe(94);
  });

  it("skips area Effect stacks on CHRYSAOR and offers brand strip", () => {
    const state = makeGameState();
    const chrysaor = addTestPlayer(state, "p1", {
      x: 3,
      y: 2,
      class: "CHRYSAOR",
      hp: 20,
    });
    addTestEnemy(state, "rose", 3, 3, { name: "Eyesting Rose", scale: 1, hp: 100 });
    addTestEnemy(state, "marked", 5, 5, { name: "Creep", hp: 20 });
    state.combat = createDefaultCombatState(1);
    applySoulBranding(state, "p1", { kind: "enemy", id: "marked" });

    const attackSpec: EnemyAttackSpec = {
      targeting: "pattern",
      patternId: "burst",
      size: 1,
      damage: "5",
      effects: ["Shock:2"],
    };
    applyPatternEnemyAttack(state, state.enemies.find((e) => e.id === "rose")!, attackSpec, "n", {
      damage: 5,
    });

    expect(chrysaor.hp).toBe(15);
    expect(chrysaor.effects?.Shock).toBeUndefined();
    expect(state.combat!.pendingClassReaction?.kind).toBe("brand_strip");
    expect(
      state.combat!.pendingClassReaction?.kind === "brand_strip" &&
        state.combat!.pendingClassReaction.candidates.some(
          (c) => c.kind === "enemy" && c.id === "marked",
        ),
    ).toBe(true);
  });

  it("does not skip Effects from select-target (direct) attacks", () => {
    const state = makeGameState();
    const chrysaor = addTestPlayer(state, "p1", {
      x: 3,
      y: 2,
      class: "CHRYSAOR",
      hp: 20,
    });
    addTestEnemy(state, "e1", 3, 3, { name: "Creep", hp: 100 });
    state.combat = createDefaultCombatState(1);

    const attackSpec: EnemyAttackSpec = {
      targeting: "select",
      damage: "5",
      effects: ["Shock:2"],
      range: 1,
    };
    applySelectTargetEnemyAttack(state, state.enemies[0]!, attackSpec, {
      targetPlayerId: "p1",
      damage: 5,
    });
    expect(chrysaor.effects?.Shock).toBe(2);
  });

  it("brand_strip accept removes one stack; decline clears pending", () => {
    const state = makeGameState();
    addTestPlayer(state, "p1", { x: 2, y: 2, class: "CHRYSAOR", hp: 20 });
    addTestEnemy(state, "e1", 3, 2, { name: "Creep", hp: 20 });
    state.combat = createDefaultCombatState(1);
    applySoulBranding(state, "p1", { kind: "enemy", id: "e1" });
    maybeOfferBrandStrip(state, state.players[0]!);
    expect(state.combat!.pendingClassReaction?.kind).toBe("brand_strip");

    const msg = applyResolveClassReaction(state, "p1", {
      action: "resolveClassReaction",
      accept: true,
      targetEnemyId: "e1",
    });
    expect(msg).toContain("Removed Brand:1");
    expect(state.enemies[0]!.effects?.[BRAND_EFFECT]).toBe(1);
    expect(state.combat!.pendingClassReaction).toBeNull();

    maybeOfferBrandStrip(state, state.players[0]!);
    const skip = applyResolveClassReaction(state, "p1", {
      action: "resolveClassReaction",
      accept: false,
    });
    expect(skip).toContain("skipped");
    expect(state.combat!.pendingClassReaction).toBeNull();
  });

  it("stripOwnedBrand clears ownership when Brand reaches 0", () => {
    const state = makeGameState();
    addTestPlayer(state, "p1", { class: "CHRYSAOR" });
    addTestEnemy(state, "e1", 3, 2, { name: "Creep" });
    state.combat = createDefaultCombatState(1);
    applySoulBranding(state, "p1", { kind: "enemy", id: "e1" });
    stripOwnedBrand(state, "p1", { kind: "enemy", id: "e1" });
    stripOwnedBrand(state, "p1", { kind: "enemy", id: "e1" });
    expect(state.enemies[0]!.effects?.[BRAND_EFFECT]).toBeUndefined();
    expect(state.combat!.chrysaorBrands!["e1"]).toBeUndefined();
  });

  it("detonates obstacle Brand", () => {
    const state = makeGameState({ width: 6, height: 6 });
    addTestPlayer(state, "p1", { x: 0, y: 0, class: "CHRYSAOR" });
    applyGmPaintTile(state, 3, 3, { terrain: "obstacle", obstacleHp: 50 });
    const adj = addTestEnemy(state, "e1", 3, 2, { name: "Gorgenaut", hp: 100, scale: 1 });
    state.combat = createDefaultCombatState(1);
    applySoulBranding(state, "p1", { kind: "obstacle", x: 3, y: 3 });
    applyTileEffectStacks(tileAt(state.tiles, 3, 3)!, [`${BRAND_EFFECT}:-1`]);
    const msgs = tickBrands(state, () => 0.99);
    expect(msgs.some((m) => m.includes("obstacle"))).toBe(true);
    expect(adj.hp).toBe(94);
    expect(tileAt(state.tiles, 3, 3)!.tileEffects?.[BRAND_EFFECT]).toBeUndefined();
  });
});
