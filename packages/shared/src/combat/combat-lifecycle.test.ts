import { afterEach, describe, expect, it, vi } from "vitest";

import { addTestPlayer, makeGameState } from "../test/fixtures.js";
import { clearCombatLifecycleHooks, replaceCombatLifecycleHooks, runPlayerAttackHit } from "./combat-lifecycle.js";

describe("runPlayerAttackHit", () => {
  afterEach(() => {
    clearCombatLifecycleHooks();
  });

  it("invokes the registered hook with the hit tiles and returns its messages", () => {
    const state = makeGameState();
    const player = addTestPlayer(state, "p1");
    const onPlayerAttackHit = vi.fn(() => ["proc message"]);
    replaceCombatLifecycleHooks({ onPlayerAttackHit });

    const result = runPlayerAttackHit(state, player, [{ x: 1, y: 1 }]);

    expect(onPlayerAttackHit).toHaveBeenCalledWith(state, player, [{ x: 1, y: 1 }]);
    expect(result).toEqual(["proc message"]);
  });

  it("does not call the hook when there are no hit tiles", () => {
    const state = makeGameState();
    const player = addTestPlayer(state, "p1");
    const onPlayerAttackHit = vi.fn(() => ["proc message"]);
    replaceCombatLifecycleHooks({ onPlayerAttackHit });

    expect(runPlayerAttackHit(state, player, [])).toEqual([]);
    expect(onPlayerAttackHit).not.toHaveBeenCalled();
  });

  it("returns an empty array when no hook is registered", () => {
    const state = makeGameState();
    const player = addTestPlayer(state, "p1");

    expect(runPlayerAttackHit(state, player, [{ x: 0, y: 0 }])).toEqual([]);
  });
});
