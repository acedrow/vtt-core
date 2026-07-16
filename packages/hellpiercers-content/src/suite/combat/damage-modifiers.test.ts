import { describe, expect, it } from "vitest";
import { resolveDamageAgainstTarget, maxWeaponDamage } from "@gaem/shared";
import { applyDamageToPlayer } from "@gaem/shared";
import { applyGmApplyDamage } from "@gaem/shared";
import { addTestPlayer, makeGameState, makeTiles } from "../fixtures.js";
import { coordKey } from "@gaem/shared";

describe("resolveDamageAgainstTarget", () => {
  it("adds Bleed bonus", () => {
    expect(resolveDamageAgainstTarget(5, { effects: { Bleed: 2 } })).toBe(7);
  });

  it("subtracts Armor stacks", () => {
    expect(resolveDamageAgainstTarget(5, { effects: { Armor: 2 } })).toBe(3);
  });

  it("subtracts Cover from effect stacks", () => {
    expect(resolveDamageAgainstTarget(5, { effects: { Cover: 1 } })).toBe(4);
  });

  it("subtracts Cover from terrain", () => {
    const state = makeGameState({
      tiles: makeTiles(5, 5, new Set([coordKey(2, 2)])),
    });
    const tile = state.tiles.find((t) => t.x === 2 && t.y === 2)!;
    tile.terrain = ["cover"];
    expect(
      resolveDamageAgainstTarget(5, { x: 2, y: 2 }, { state, hitTile: { x: 2, y: 2 } }),
    ).toBe(4);
  });

  it("uses max damage when Broken and damageSpec provided", () => {
    const spec = "3+2D6";
    expect(
      resolveDamageAgainstTarget(3, { effects: { Broken: 1 } }, { damageSpec: spec }),
    ).toBe(maxWeaponDamage(spec));
  });

  it("does not force max when Broken but no damageSpec", () => {
    expect(resolveDamageAgainstTarget(3, { effects: { Broken: 1 } })).toBe(3);
  });

  it("floors at zero", () => {
    expect(resolveDamageAgainstTarget(2, { effects: { Armor: 5 } })).toBe(0);
  });
});

describe("applyDamageToPlayer with modifiers", () => {
  it("applies Armor through applyDamageToPlayer", () => {
    const state = makeGameState();
    addTestPlayer(state, "p1", { x: 2, y: 2, hp: 10, class: "HARPE", effects: { Armor: 2 } });
    const player = state.players[0]!;
    applyDamageToPlayer(player, 5, state);
    expect(player.hp).toBe(7);
  });

  it("GM apply damage respects Armor", () => {
    const state = makeGameState();
    addTestPlayer(state, "p1", { x: 2, y: 2, hp: 10, class: "HARPE", effects: { Armor: 1 } });
    applyGmApplyDamage(state, { kind: "player", id: "p1" }, 4);
    expect(state.players[0]!.hp).toBe(7);
  });
});
