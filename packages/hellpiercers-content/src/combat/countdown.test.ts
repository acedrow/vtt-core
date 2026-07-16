import { describe, expect, it } from "vitest";
import {
  getCountdownKind,
  resolveCountdownExpiry,
  tickRoundCountdowns,
  trackCountdownKinds,
} from "@gaem/shared";
import { applyEffectStacks } from "@gaem/shared";
import { createDefaultCombatState } from "@gaem/shared";
import { addTestEnemy, addTestPlayer, makeGameState } from "../../../shared/src/test/fixtures.js";

describe("resolveCountdownExpiry", () => {
  it("flowerbud blooms into Stain Flower", () => {
    const state = makeGameState({ combat: createDefaultCombatState(0) });
    const enemy = addTestEnemy(state, "bud", 3, 4, { name: "Flowerbud", hp: 1 });
    applyEffectStacks(enemy, ["Countdown:1"]);
    const msgs = resolveCountdownExpiry({ state, unit: enemy });
    expect(state.enemies.some((e) => e.name === "Stain Flower" && e.x === 3 && e.y === 4)).toBe(true);
    expect(state.enemies.some((e) => e.id === "bud")).toBe(false);
    expect(msgs.some((m) => m.includes("Stain Flower"))).toBe(true);
  });

  it("chazaor agnosia kills and bursts", () => {
    const state = makeGameState({ combat: createDefaultCombatState(0) });
    addTestPlayer(state, "p1", { x: 3, y: 4, hp: 10, class: "HARPE" });
    const enemy = addTestEnemy(state, "ch", 3, 4, { name: "Soaring Bombardier", hp: 20 });
    const msgs = resolveCountdownExpiry({ state, unit: enemy, kind: "chazaor_agnosia" });
    expect(enemy.hp).toBe(0);
    expect(state.players[0]!.hp).toBe(5);
    expect(msgs.some((m) => m.includes("agnosia"))).toBe(true);
  });

  it("infers chazaor kind from Soaring Bombardier display name", () => {
    const state = makeGameState({ combat: createDefaultCombatState(0) });
    const enemy = addTestEnemy(state, "ch", 3, 4, { name: "Soaring Bombardier", hp: 20 });
    applyEffectStacks(enemy, ["Countdown:1"]);
    trackCountdownKinds(state, enemy, ["Countdown:1"]);
    expect(getCountdownKind(state, enemy.id)).toBe("chazaor_agnosia");
  });

  it("unknown kind creates pending GM action", () => {
    const state = makeGameState({ combat: createDefaultCombatState(0) });
    const player = addTestPlayer(state, "p1", { x: 1, y: 1, class: "HARPE" });
    resolveCountdownExpiry({ state, unit: player });
    expect(state.combat!.pendingActions.some((p) => p.label === "Countdown expired")).toBe(true);
  });
});

describe("tickRoundCountdowns", () => {
  it("triggers handler when countdown reaches zero", () => {
    const state = makeGameState({ combat: createDefaultCombatState(0) });
    const enemy = addTestEnemy(state, "bud", 2, 2, { name: "Flowerbud", hp: 1 });
    applyEffectStacks(enemy, ["Countdown:1"]);
    tickRoundCountdowns(state);
    expect(state.enemies.some((e) => e.name === "Stain Flower")).toBe(true);
  });
});
