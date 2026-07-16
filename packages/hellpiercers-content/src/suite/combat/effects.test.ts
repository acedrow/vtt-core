import { describe, expect, it } from "vitest";
import { tickUnitEndOfTurn, tickUnitStartOfTurn } from "@gaem/shared";
import { addTestEnemy, addTestPlayer, makeGameState } from "../fixtures.js";
import { applyTileEffectStacks } from "@gaem/shared";
import { tileAt } from "@gaem/shared";

describe("tickUnitStartOfTurn", () => {
  it("deals flat 1 Blazing damage regardless of stack count", () => {
    const state = makeGameState();
    addTestPlayer(state, "p1", { x: 2, y: 2, hp: 10, class: "HARPE", effects: { Blazing: 3 } });
    const msgs = tickUnitStartOfTurn(state, state.players[0]!, "player");
    expect(state.players[0]!.hp).toBe(9);
    expect(msgs.some((m) => m.includes("Blazing"))).toBe(true);
  });

  it("spreads Blazing to a unit only when that unit's own turn begins", () => {
    const state = makeGameState();
    addTestPlayer(state, "p1", { x: 2, y: 2, hp: 10, class: "HARPE", effects: { Blazing: 1 } });
    addTestEnemy(state, "e1", 2, 3, { hp: 5 });

    tickUnitStartOfTurn(state, state.players[0]!, "player");
    expect(state.players[0]!.hp).toBe(9);
    expect(state.enemies[0]!.effects?.Blazing).toBeUndefined();
    expect(state.enemies[0]!.hp).toBe(5);

    const msgs = tickUnitStartOfTurn(state, state.enemies[0]!, "enemy");
    expect(state.enemies[0]!.effects?.Blazing).toBe(1);
    expect(state.enemies[0]!.hp).toBe(4);
    expect(msgs.some((m) => m.includes("Blazing"))).toBe(true);
  });

  it("Fortified restores reversal charges for players", () => {
    const state = makeGameState();
    addTestPlayer(state, "p1", { x: 2, y: 2, hp: 10, class: "HARPE", reversalCharges: 0 });
    const tile = tileAt(state.tiles, 2, 2)!;
    applyTileEffectStacks(tile, ["Fortified:1"]);
    tickUnitStartOfTurn(state, state.players[0]!, "player");
    expect(state.players[0]!.reversalCharges).toBe(2);
    expect(tile.tileEffects?.Fortified).toBeUndefined();
  });
});

describe("tickUnitEndOfTurn", () => {
  it("deals Poison damage then decrements", () => {
    const state = makeGameState();
    addTestPlayer(state, "p1", { x: 1, y: 1, hp: 10, class: "HARPE", effects: { Poison: 3 } });
    const msgs = tickUnitEndOfTurn(state, state.players[0]!);
    expect(state.players[0]!.hp).toBe(7);
    expect(state.players[0]!.effects?.Poison).toBe(2);
    expect(msgs.some((m) => m.includes("Poison"))).toBe(true);
  });

  it("Blazing only ticks down when no adjacent Blazing", () => {
    const state = makeGameState();
    addTestPlayer(state, "p1", { x: 2, y: 2, hp: 10, class: "HARPE", effects: { Blazing: 2 } });
    tickUnitEndOfTurn(state, state.players[0]!);
    expect(state.players[0]!.effects?.Blazing).toBe(1);

    addTestEnemy(state, "e1", 2, 3, { hp: 5, effects: { Blazing: 1 } });
    tickUnitEndOfTurn(state, state.players[0]!);
    expect(state.players[0]!.effects?.Blazing).toBe(1);
  });
});
